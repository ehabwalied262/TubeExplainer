let currentPage = 1;
let totalPages = 0;
let captions = [];
let currentFolderPath = [];
let currentVideoTitle = '';

// Load folder structure from localStorage
let folderStructure = JSON.parse(localStorage.getItem('folderStructure')) || { name: "root", type: "folder", children: [] };

function saveFolderStructure() {
    localStorage.setItem('folderStructure', JSON.stringify(folderStructure));
}

function folderExists(name, parentFolder) {
    return parentFolder.children.some(item => item.type === "folder" && item.name.toLowerCase() === name.toLowerCase());
}

function fileExists(name, parentFolder) {
    return parentFolder.children.some(item => item.type === "file" && item.name.toLowerCase() === name.toLowerCase());
}

function showContextMenu(x, y, items) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.label;
        menuItem.onclick = () => {
            item.action();
            menu.remove();
        };
        menu.appendChild(menuItem);
    });
    document.body.appendChild(menu);

    document.addEventListener('click', () => menu.remove(), { once: true });
}

function renderFolderStructure(container, structure, path = []) {
    container.innerHTML = '';
    if (path.length > 0) {
        const backBtn = document.createElement("div");
        backBtn.className = "folder flex items-center";
        backBtn.innerHTML = `<i class="fas fa-arrow-left mr-2"></i> ..`;
        backBtn.onclick = () => {
            currentFolderPath.pop();
            renderFolderStructure(container, getCurrentFolder(), currentFolderPath);
        };
        backBtn.oncontextmenu = (e) => e.preventDefault();
        container.appendChild(backBtn);
    }
    if (structure.children.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "text-[#c0c0c0] italic";
        emptyMsg.textContent = "This folder is empty.";
        container.appendChild(emptyMsg);
    } else {
        structure.children.forEach((item, index) => {
            const itemDiv = document.createElement("div");
            itemDiv.className = item.type === "folder" ? "folder flex items-center" : "file flex items-center";
            const nameSpan = document.createElement("span");
            nameSpan.textContent = item.name;
            nameSpan.className = "truncate flex-1";
            itemDiv.appendChild(nameSpan);

            if (item.type === "file") {
                const editBtn = document.createElement("button");
                editBtn.innerHTML = `<i class="fas fa-edit text-[#c0c0c0] hover:text-[#ebebeb]"></i>`;
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    const newName = prompt("Enter new file name:", item.name.replace('.txt', ''));
                    if (newName) {
                        const newFileName = `${newName}.txt`;
                        if (fileExists(newFileName, structure) && newFileName !== item.name) {
                            alert("A file with this name already exists.");
                            return;
                        }
                        item.name = newFileName;
                        saveFolderStructure();
                        renderFolderStructure(container, structure, path);
                    }
                };
                itemDiv.appendChild(editBtn);
            }

            itemDiv.oncontextmenu = (e) => {
                e.preventDefault();
                const items = item.type === "folder" ? [
                    { label: "Rename", action: () => {
                        const newName = prompt("Enter new folder name:", item.name);
                        if (newName) {
                            if (folderExists(newName, structure)) {
                                alert("A folder with this name already exists.");
                                return;
                            }
                            item.name = newName;
                            saveFolderStructure();
                            renderFolderStructure(container, structure, path);
                        }
                    }},
                    { label: "Delete", action: () => {
                        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                            structure.children.splice(index, 1);
                            saveFolderStructure();
                            renderFolderStructure(container, structure, path);
                        }
                    }}
                ] : [
                    { label: "Open", action: () => {
                        const modal = document.getElementById("editor-modal");
                        document.getElementById("editor-title").textContent = item.name;
                        document.getElementById("editor-content").value = item.content;
                        modal.style.display = "block";
                    }},
                    { label: "Rename", action: () => {
                        const newName = prompt("Enter new file name:", item.name.replace('.txt', ''));
                        if (newName) {
                            const newFileName = `${newName}.txt`;
                            if (fileExists(newFileName, structure) && newFileName !== item.name) {
                                alert("A file with this name already exists.");
                                return;
                            }
                            item.name = newFileName;
                            saveFolderStructure();
                            renderFolderStructure(container, structure, path);
                        }
                    }},
                    { label: "Delete", action: () => {
                        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                            structure.children.splice(index, 1);
                            saveFolderStructure();
                            renderFolderStructure(container, structure, path);
                        }
                    }}
                ];
                showContextMenu(e.pageX, e.pageY, items);
            };

            if (item.type === "folder") {
                itemDiv.onclick = () => {
                    currentFolderPath.push(index);
                    renderFolderStructure(container, item, currentFolderPath);
                };
            } else {
                itemDiv.onclick = () => {
                    const modal = document.getElementById("editor-modal");
                    document.getElementById("editor-title").textContent = item.name;
                    document.getElementById("editor-content").value = item.content;
                    modal.style.display = "block";
                };
            }
            container.appendChild(itemDiv);
        });
    }
}

function renderModalFolderStructure() {
    const modalContainer = document.getElementById("modal-folder-structure");
    modalContainer.innerHTML = '';
    const structure = folderStructure;
    if (structure.children.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "text-[#c0c0c0] italic";
        emptyMsg.textContent = "No folders available. Create a folder first.";
        modalContainer.appendChild(emptyMsg);
    } else {
        structure.children.forEach((item, index) => {
            if (item.type === "folder") {
                const itemDiv = document.createElement("div");
                itemDiv.className = "folder flex items-center p-2 border-b border-[#ebebeb] cursor-pointer hover:bg-[#4a5568]";
                itemDiv.innerHTML = `<i class="fas fa-folder mr-2"></i> ${item.name}`;
                itemDiv.onclick = () => {
                    document.querySelectorAll("#modal-folder-structure .folder").forEach(div => div.classList.remove("bg-[#3a6ea5]"));
                    itemDiv.classList.add("bg-[#3a6ea5]");
                    modalContainer.dataset.selectedFolder = index;
                };
                modalContainer.appendChild(itemDiv);
            }
        });
    }
}

function getCurrentFolder() {
    let current = folderStructure;
    for (let index of currentFolderPath) {
        current = current.children[index];
    }
    return current;
}

document.getElementById("create-folder-btn").addEventListener("click", () => {
    const folderName = prompt("Enter folder name:");
    if (folderName) {
        const currentFolder = getCurrentFolder();
        if (folderExists(folderName, currentFolder)) {
            alert("A folder with this name already exists.");
            return;
        }
        currentFolder.children.push({ name: folderName, type: "folder", children: [] });
        saveFolderStructure();
        renderFolderStructure(document.getElementById("folder-structure"), currentFolder, currentFolderPath);
    }
});

document.getElementById("folder-structure").addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (e.target === document.getElementById("folder-structure") || e.target.classList.contains("folder-structure")) {
        showContextMenu(e.pageX, e.pageY, [
            { label: "Create a new folder", action: () => {
                const folderName = prompt("Enter folder name:");
                if (folderName) {
                    const currentFolder = getCurrentFolder();
                    if (folderExists(folderName, currentFolder)) {
                        alert("A folder with this name already exists.");
                        return;
                    }
                    currentFolder.children.push({ name: folderName, type: "folder", children: [] });
                    saveFolderStructure();
                    renderFolderStructure(document.getElementById("folder-structure"), currentFolder, currentFolderPath);
                }
            }}
        ]);
    }
});

document.getElementById("save-to-library-btn").addEventListener("click", () => {
    if (captions.length === 0) {
        alert("No captions to save.");
        return;
    }
    const currentFolder = getCurrentFolder();
    const fileName = `${currentVideoTitle}.txt`;
    if (fileExists(fileName, currentFolder)) {
        const toast = document.getElementById("toast");
        toast.textContent = "Already saved!";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
        return;
    }
    const modal = document.getElementById("save-modal");
    modal.style.display = "block";
    renderModalFolderStructure();
});

document.getElementById("confirm-save-btn").addEventListener("click", () => {
    const modalContainer = document.getElementById("modal-folder-structure");
    const selectedFolderIndex = modalContainer.dataset.selectedFolder;
    if (selectedFolderIndex === undefined) {
        alert("Please select a folder to save the captions.");
        return;
    }
    const currentFolder = folderStructure.children[selectedFolderIndex];
    const fileName = `${currentVideoTitle}.txt`;
    if (fileExists(fileName, currentFolder)) {
        const toast = document.getElementById("toast");
        toast.textContent = "Already saved!";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
        document.getElementById("save-modal").style.display = "none";
        return;
    }
    currentFolder.children.push({
        name: fileName,
        type: "file",
        content: captions.join("\n\n")
    });
    saveFolderStructure();
    renderFolderStructure(document.getElementById("folder-structure"), getCurrentFolder(), currentFolderPath);
    document.getElementById("save-modal").style.display = "none";
});

document.querySelectorAll(".close").forEach(closeBtn => {
    closeBtn.addEventListener("click", () => {
        closeBtn.closest(".modal").style.display = "none";
    });
});

window.onclick = (event) => {
    const saveModal = document.getElementById("save-modal");
    const editorModal = document.getElementById("editor-modal");
    if (event.target === saveModal) {
        saveModal.style.display = "none";
    }
    if (event.target === editorModal) {
        editorModal.style.display = "none";
    }
};

// Initial render of folder structure
renderFolderStructure(document.getElementById("folder-structure"), folderStructure, currentFolderPath);

document.querySelectorAll(".lang-btn").forEach(button => {
    button.addEventListener("click", async () => {
        const baseUrl = button.dataset.baseUrl;
        const langCode = button.dataset.langCode;
        const isAuto = button.dataset.isAuto === "True";
        const videoTitle = button.dataset.videoTitle;

        document.getElementById("captions").classList.add("hidden");
        document.getElementById("error").classList.add("hidden");
        document.getElementById("lang-buttons").classList.add("hidden");
        document.getElementById("lang-header").classList.add("hidden");
        document.getElementById("loading").classList.remove("hidden");

        try {
            const response = await fetch("/get_captions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ base_url: baseUrl, lang_code: langCode, is_auto: isAuto, video_title: videoTitle })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.captions) {
                captions = data.captions;
                totalPages = data.total_pages;
                currentPage = 1;
                currentVideoTitle = data.video_title;
                updatePagination();
                document.getElementById("video-title").innerHTML = `Captions for ${data.video_title.substring(0, 30)}${data.video_title.length > 30 ? '...' : ''} <span class="tooltip-text">${data.video_title}</span>`;
                document.getElementById("captions").classList.remove("hidden");
            } else {
                document.getElementById("error").textContent = data.error || "Failed to fetch captions.";
                document.getElementById("error").classList.remove("hidden");
                document.getElementById("lang-buttons").classList.remove("hidden");
                document.getElementById("lang-header").classList.remove("hidden");
            }
        } catch (e) {
            document.getElementById("error").textContent = `An error occurred: ${e.message}`;
            document.getElementById("error").classList.remove("hidden");
            document.getElementById("lang-buttons").classList.remove("hidden");
            document.getElementById("lang-header").classList.remove("hidden");
        } finally {
            document.getElementById("loading").classList.add("hidden");
        }
    });
});

function updatePagination() {
    const start = (currentPage - 1) * 5;
    const end = start + 5;
    const pageCaptions = captions.slice(start, end).join("\n\n");
    document.getElementById("caption-text").innerHTML = `<p>${pageCaptions}</p>`;
    document.getElementById("page-info").textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById("prev-page").disabled = currentPage === 1;
    document.getElementById("next-page").disabled = currentPage === totalPages;

    const pageNumbers = document.getElementById("page-numbers");
    pageNumbers.innerHTML = '';
    if (totalPages > 1) {
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement("button");
            btn.textContent = i;
            btn.className = `p-2 rounded-full border border-[#ebebeb] ${i === currentPage ? 'bg-[#3a6ea5] text-[#c0c0c0]' : 'text-[#c0c0c0] hover:bg-[#4a5568]'} transition`;
            btn.onclick = () => {
                currentPage = i;
                updatePagination();
            };
            pageNumbers.appendChild(btn);
        }
    }
}

document.getElementById("copy-btn").addEventListener("click", () => {
    const captionText = document.getElementById("caption-text").textContent;
    navigator.clipboard.writeText(captionText).then(() => {
        const toast = document.getElementById("toast");
        toast.textContent = "Copied!";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
    });
});

document.getElementById("prev-page").onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        updatePagination();
    }
};
document.getElementById("next-page").onclick = () => {
    if (currentPage < totalPages) {
        currentPage++;
        updatePagination();
    }
};

const modeToggle = document.getElementById('mode-toggle');
modeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
    const icon = modeToggle.querySelector('i');
    const tooltipText = modeToggle.querySelector('.tooltip-text');
    if (document.body.classList.contains('dark-mode')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        tooltipText.textContent = 'Toggle Light Mode';
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        tooltipText.textContent = 'Toggle Dark Mode';
    }
});