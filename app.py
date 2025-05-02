from flask import Flask, render_template, request, jsonify, send_file
import requests
import re
from bs4 import BeautifulSoup
import webvtt
import json
import xml.etree.ElementTree as ET
import os
import io
import logging

app = Flask(__name__)

# Set up logging
logging.basicConfig(level=logging.DEBUG)

def get_video_id(url):
    pattern = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(pattern, url)
    return match.group(1) if match else None

def get_video_title(video_id):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        response = requests.get(f"https://www.youtube.com/watch?v={video_id}", headers=headers)
        if response.status_code != 200:
            app.logger.error(f"Failed to fetch video page, status code: {response.status_code}")
            return "video"
        soup = BeautifulSoup(response.text, "html.parser")
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.text.replace(" - YouTube", "").strip()
            title = re.sub(r'[<>:"/\\|?*]', '', title)
            title = title.replace(" ", "_")
            return title if title else "video"
        app.logger.error("Title tag not found in video page")
        return "video"
    except Exception as e:
        app.logger.error(f"Error fetching video title: {str(e)}")
        return "video"

def get_available_languages(video_id):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        response = requests.get(f"https://www.youtube.com/watch?v={video_id}", headers=headers)
        if response.status_code != 200:
            app.logger.error(f"Failed to fetch video page for languages, status code: {response.status_code}")
            return None
        soup = BeautifulSoup(response.text, "html.parser")
        script_tags = soup.find_all("script")
        caption_tracks = None
        for script in script_tags:
            if "captionTracks" in script.text:
                match = re.search(r'"captionTracks":(\[.*?\])', script.text)
                if match:
                    caption_tracks = json.loads(match.group(1))
                    break
        if not caption_tracks:
            app.logger.error("No caption tracks found in video page")
            return None
        languages = []
        for track in caption_tracks:
            lang_code = track.get("languageCode")
            lang_name = track.get("name", {}).get("simpleText", lang_code)
            is_auto = track.get("kind") == "asr"
            base_url = track.get("baseUrl")
            if lang_code and base_url:
                languages.append({"code": lang_code, "name": lang_name, "is_auto": is_auto, "base_url": base_url})
        app.logger.debug(f"Available languages: {languages}")
        return languages
    except Exception as e:
        app.logger.error(f"Error fetching available languages: {str(e)}")
        return None

def get_captions(base_url, is_auto=False):
    urls = [base_url]
    if is_auto:
        urls.extend([
            f"{base_url}&kind=asr",
            f"{base_url}&fmt=srv3",
            f"{base_url}&kind=asr&fmt=srv3"
        ])
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9"
    }
    for url in urls:
        try:
            app.logger.debug(f"Attempting to fetch captions from URL: {url}")
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                app.logger.debug("Successfully fetched captions")
                return response.text
            app.logger.warning(f"Failed to fetch captions from {url}, status code: {response.status_code}")
        except Exception as e:
            app.logger.error(f"Error fetching captions from {url}: {str(e)}")
    app.logger.error("Failed to fetch captions from all URLs")
    return None

def xml_to_txt(xml_content):
    try:
        root = ET.fromstring(xml_content)
        txt_content = []
        for text_tag in root.findall(".//text"):
            text = text_tag.text
            if text:
                text = BeautifulSoup(text, "html.parser").get_text()
                txt_content.append(text)
        app.logger.debug(f"Extracted {len(txt_content)} text lines from XML")
        return txt_content
    except Exception as e:
        app.logger.error(f"Error converting XML to text: {e}")
        return None

def vtt_to_txt(vtt_content):
    try:
        vtt = webvtt.from_string(vtt_content)
        txt_content = []
        for caption in vtt.captions:
            txt_content.append(caption.text)
        app.logger.debug(f"Extracted {len(txt_content)} captions from VTT")
        return txt_content
    except Exception as e:
        app.logger.error(f"Error converting VTT to text: {e}")
        return None

def format_paragraphs(txt_lines):
    if not txt_lines:
        app.logger.warning("No text lines to format")
        return []
    paragraphs = []
    current_paragraph = []
    word_count = 0
    for line in txt_lines:
        current_paragraph.append(line)
        words = len(line.split())
        word_count += words
        if word_count >= 50 or line.strip().endswith("."):
            paragraphs.append(" ".join(current_paragraph))
            current_paragraph = []
            word_count = 0
    if current_paragraph:
        paragraphs.append(" ".join(current_paragraph))
    app.logger.debug(f"Formatted {len(paragraphs)} paragraphs")
    return paragraphs

@app.route("/", methods=["GET", "POST"])
def index():
    error = None
    if request.method == "POST":
        youtube_url = request.form.get("youtube_url")
        app.logger.debug(f"Received YouTube URL: {youtube_url}")
        video_id = get_video_id(youtube_url)
        if not video_id:
            error = "Invalid YouTube URL. Please try again."
            app.logger.error("Invalid YouTube URL")
        else:
            languages = get_available_languages(video_id)
            if not languages:
                error = "No captions available for this video."
                app.logger.error("No captions available for this video")
            else:
                video_title = get_video_title(video_id)
                return render_template("captions_base.html", video_id=video_id, video_title=video_title, languages=languages)
        return render_template("index.html", error=error)
    return render_template("index.html", error=None)

@app.route("/get_captions", methods=["POST"])
def get_captions_endpoint():
    data = request.get_json()
    base_url = data.get("base_url")
    lang_code = data.get("lang_code")
    is_auto = data.get("is_auto", False)
    video_title = data.get("video_title")
    
    app.logger.debug(f"Fetching captions for base_url: {base_url}, lang_code: {lang_code}, is_auto: {is_auto}")
    captions = get_captions(base_url, is_auto)
    if captions:
        txt_lines = None
        if captions.startswith("WEBVTT"):
            app.logger.debug("Processing VTT captions")
            txt_lines = vtt_to_txt(captions)
        elif captions.startswith("<?xml"):
            app.logger.debug("Processing XML captions")
            txt_lines = xml_to_txt(captions)
        else:
            app.logger.error("Unknown captions format")
            return jsonify({"error": "Unknown captions format."})
        if txt_lines:
            paragraphs = format_paragraphs(txt_lines)
            page_size = 5  # 5 paragraphs per page
            total_pages = (len(paragraphs) + page_size - 1) // page_size
            app.logger.debug(f"Returning {len(paragraphs)} paragraphs, {total_pages} pages")
            return jsonify({
                "captions": paragraphs,
                "total_pages": total_pages,
                "video_title": video_title.replace("_", " ")
            })
        app.logger.error("Failed to extract text lines from captions")
        return jsonify({"error": "Failed to extract text from captions."})
    app.logger.error("No captions fetched")
    return jsonify({"error": "Failed to fetch captions from YouTube."})

if __name__ == "__main__":
    app.run(debug=True)