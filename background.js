chrome.commands.onCommand.addListener((command) => {
  if (command === "open-search-box") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.bookmarks.getTree((bookmarkTreeNodes) => {
          chrome.scripting
            .executeScript({
              target: { tabId: tabs[0].id },
              function: toggleSearchBox,
              args: [bookmarkTreeNodes],
            })
            .catch((error) => console.error("Script execution error:", error));
        });
      }
    });
  }
});

function toggleSearchBox(bookmarkTreeNodes) {
  const existingBox = document.getElementById("custom-search-box");
  if (existingBox) {
    existingBox.remove();
  } else {
    const createSearchBox = () => {
      const searchBox = document.createElement("div");
      searchBox.id = "custom-search-box";
      searchBox.style.position = "fixed";
      searchBox.style.top = "40%";
      searchBox.style.left = "50%";
      searchBox.style.transform = "translate(-50%, -50%)";
      searchBox.style.zIndex = "10000";
      searchBox.style.backgroundColor = "rgba(249, 249, 249, 0.8)";
      searchBox.style.border = "1px solid #ccc";
      searchBox.style.borderRadius = "8px";
      searchBox.style.padding = "15px";
      searchBox.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
      searchBox.style.width = "30%";
      searchBox.style.maxHeight = "50%";
      searchBox.style.overflowY = "auto";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Search...";
      input.style.width = "100%";
      input.style.padding = "10px";
      input.style.border = "1px solid #ddd";
      input.style.borderRadius = "4px";
      input.style.boxSizing = "border-box";
      input.style.backgroundColor = "rgba(249, 249, 249, 0.8)";

      const bookmarkList = document.createElement("ul");
      bookmarkList.style.listStyleType = "none";
      bookmarkList.style.padding = "0";
      bookmarkList.style.marginTop = "10px";
      bookmarkList.style.maxHeight = "50%";
      bookmarkList.style.overflowY = "auto";

      let currentIndex = -1; // 当前选中的书签索引

      const displayBookmarks = (nodes, parentElement) => {
        nodes.forEach((node) => {
          const listItem = document.createElement("li");
          if (node.children) {
            // 处理文件夹
            const folderTitle = document.createElement("span");
            folderTitle.style.display = "flex";
            folderTitle.style.alignItems = "center";

            const folderIcon = document.createElement("span");
            folderIcon.textContent = "📂"; // 使用 emoji 作为文件夹图标
            folderIcon.style.marginRight = "5px";

            const folderText = document.createElement("span");
            folderText.textContent = node.title || "⭐️ Bookmarks Tools";
            folderText.style.fontWeight = "bold";
            folderText.style.cursor = "pointer";
            folderText.style.display = "block";
            folderText.style.padding = "5px 0";
            folderText.style.borderBottom = "1px solid #ddd";

            folderTitle.appendChild(folderIcon);
            folderTitle.appendChild(folderText);

            const subList = document.createElement("ul");
            subList.style.listStyleType = "none";
            subList.style.paddingLeft = "20px";
            subList.style.display = "block"; // 默认展开子书签

            folderText.addEventListener("click", () => {
              subList.style.display =
                subList.style.display === "none" ? "block" : "none";
            });

            listItem.appendChild(folderTitle);
            listItem.appendChild(subList);
            displayBookmarks(node.children, subList);
          } else {
            // 处理单个书签
            const link = document.createElement("a");
            link.href = node.url;
            link.textContent = node.title || "无标题书签";
            link.style.display = "flex";
            link.style.alignItems = "center";
            link.style.padding = "5px 0";
            link.style.color = "#000";
            link.style.textDecoration = "none";
            link.style.borderBottom = "1px solid #ddd";

            const icon = document.createElement("img");
            icon.src = getFaviconUrl(node.url); // 根据 URL 获取 favicon
            icon.style.width = "16px";
            icon.style.height = "16px";
            icon.style.marginRight = "5px";
            icon.onerror = () => {
              icon.style.display = "none"; // 隐藏图片
              const starIcon = document.createElement("span");
              starIcon.textContent = "⭐️"; // 显示星星图标
              starIcon.style.marginRight = "5px";
              link.prepend(starIcon);
            };

            link.prepend(icon);

            link.addEventListener("click", (event) => {
              event.preventDefault(); // 阻止默认行为
              window.open(link.href, "_blank"); // 在新标签页中打开
              const openBox = document.getElementById("custom-search-box");
              if (openBox) {
                openBox.remove();
              }
            });

            listItem.appendChild(link);
          }
          parentElement.appendChild(listItem);
        });
      };

      const getFaviconUrl = (url) => {
        try {
          const urlObj = new URL(url);
          return `${urlObj.origin}/favicon.ico`;
        } catch (e) {
          return ""; // 返回空字符串以触发 onerror
        }
      };

      const filterBookmarks = (query, nodes, parentElement) => {
        parentElement.innerHTML = ""; // 清空当前列表
        let hasMatches = false; // 用于跟踪是否有匹配项
        nodes.forEach((node) => {
          if (node.children) {
            const subList = document.createElement("ul");
            subList.style.listStyleType = "none";
            subList.style.paddingLeft = "20px";
            subList.style.display = "block";

            const folderMatches = node.title.toLowerCase().includes(query);
            const childMatches = filterBookmarks(query, node.children, subList);

            if (folderMatches || childMatches) {
              const listItem = document.createElement("li");
              const folderTitle = document.createElement("span");
              folderTitle.style.display = "flex";
              folderTitle.style.alignItems = "center";

              const folderIcon = document.createElement("span");
              folderIcon.textContent = "📂";
              folderIcon.style.marginRight = "5px";

              const folderText = document.createElement("span");
              folderText.textContent = node.title || "⭐️ Bookmarks Tools";
              folderText.style.fontWeight = "bold";
              folderText.style.cursor = "pointer";
              folderText.style.display = "block";
              folderText.style.padding = "5px 0";
              folderText.style.borderBottom = "1px solid #ddd";

              folderTitle.appendChild(folderIcon);
              folderTitle.appendChild(folderText);

              folderText.addEventListener("click", () => {
                subList.style.display =
                  subList.style.display === "none" ? "block" : "none";
              });

              listItem.appendChild(folderTitle);
              listItem.appendChild(subList);
              parentElement.appendChild(listItem);
              hasMatches = true; // 有匹配项
            }
          } else if (node.title.toLowerCase().includes(query)) {
            const listItem = document.createElement("li");
            const link = document.createElement("a");
            link.href = node.url;
            link.textContent = node.title || "Untitled Bookmark";
            link.style.display = "flex";
            link.style.alignItems = "center";
            link.style.padding = "5px 0";
            link.style.color = "#000";
            link.style.textDecoration = "none";
            link.style.borderBottom = "1px solid #ddd";

            const icon = document.createElement("img");
            icon.src = getFaviconUrl(node.url); // 根据 URL 获取 favicon
            icon.style.width = "16px";
            icon.style.height = "16px";
            icon.style.marginRight = "5px";
            icon.onerror = () => {
              icon.style.display = "none"; // 隐藏图片
              const starIcon = document.createElement("span");
              starIcon.textContent = "⭐️"; // 显示星星图标
              starIcon.style.marginRight = "5px";
              link.prepend(starIcon);
            };

            link.prepend(icon);

            link.addEventListener("click", (event) => {
              event.preventDefault(); // 阻止默认行为
              window.open(link.href, "_blank"); // 在新标签页中打开
              const openBox = document.getElementById("custom-search-box");
              if (openBox) {
                openBox.remove();
              }
            });

            listItem.appendChild(link);
            parentElement.appendChild(listItem);
            hasMatches = true; // 有匹配项
          }
        });
        return hasMatches; // 返回是否有匹配项
      };

      input.addEventListener("input", () => {
        const query = input.value.toLowerCase();
        filterBookmarks(query, bookmarkTreeNodes, bookmarkList);
      });

      input.addEventListener("keydown", (event) => {
        const items = bookmarkList.querySelectorAll("li");
        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (currentIndex < items.length - 1) {
            currentIndex++;
            items.forEach((item, index) => {
              item.style.backgroundColor =
                index === currentIndex ? "#e0e0e0" : "";
            });
          }
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          if (currentIndex > 0) {
            currentIndex--;
            items.forEach((item, index) => {
              item.style.backgroundColor =
                index === currentIndex ? "#e0e0e0" : "";
            });
          }
        } else if (event.key === "Enter" && currentIndex >= 0) {
          const selectedLink = items[currentIndex].querySelector("a");
          if (selectedLink) {
            window.open(selectedLink.href, "_blank");
            searchBox.remove();
          }
        }
      });

      displayBookmarks(bookmarkTreeNodes, bookmarkList);

      searchBox.appendChild(input);
      searchBox.appendChild(bookmarkList);
      document.body.appendChild(searchBox);
      input.focus();

      // 添加键盘事件监听器
      document.addEventListener("keydown", function escListener(event) {
        if (event.key === "Escape") {
          searchBox.remove();
          document.removeEventListener("keydown", escListener); // 移除监听器
        }
      });
    };

    createSearchBox();
  }
}
