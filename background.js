const groupTabsByHost = (tabs) => {
  const groupedTabs = {};
  tabs.forEach((tab) => {
    try {
      const url = new URL(tab.url);
      let host = url.hostname.split(".")[0];
      if (host == "www") {
        host = url.hostname.split(".")[1];
      }
      if (!groupedTabs[host]) {
        groupedTabs[host] = [];
      }
      groupedTabs[host].push(tab);
    } catch (e) {
      console.log("Invalid URL:", tab.url);
    }
  });
  return groupedTabs;
};

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-search-box") {
    chrome.tabs.query({}, (alltabs) => {
      chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.bookmarks.getTree((bookmarkTreeNodes) => {
            chrome.scripting
              .executeScript({
                target: { tabId: tabs[0].id },
                function: tabGrouper,
                args: [bookmarkTreeNodes, alltabs],
              })
              .catch((error) => console.log("Script execution error:", error));
          });
        }
      });
    });
  }
});

// 监听消息以激活标签页
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "activateTab") {
    chrome.tabs.update(request.tabId, { active: true });
  } else if (request.action === "removeTab") {
    chrome.tabs.remove(request.tabId, () => {
      sendResponse({ success: true });
    });
    return true; // 表示异步响应
  } else if (request.action === "refreshGroupedTabs") {
    chrome.tabs.query({}, (alltabs) => {
      chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.bookmarks.getTree((bookmarkTreeNodes) => {
            chrome.scripting
              .executeScript({
                target: { tabId: tabs[0].id },
                function: tabGrouper,
                args: [bookmarkTreeNodes, alltabs],
              })
              .catch((error) => console.log("Script execution error:", error));
          });
        }
      });
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (alltabs) => {
    const groupedTabs = groupTabsByHost(alltabs);
    Object.keys(groupedTabs).forEach((host) => {
      chrome.tabs.group(
        {
          tabIds: groupedTabs[host].map((tab) => tab.id),
        },
        (groupId) => {
          chrome.tabGroups.update(groupId, {
            title: host,
          });
        }
      );
    });
  });
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  chrome.tabs.query({}, async (alltabs) => {
    const groupedTabs = groupTabsByHost(alltabs);
    if (changeInfo.status === "complete") {
      const url = new URL(tab.url);
      let host = url.hostname.split(".")[0];
      if (host == "www") {
        host = url.hostname.split(".")[1];
      }

      var groupExists = false;
      // 使用 await 等待 Promise 完成
      const groups = await chrome.tabGroups.query({});
      groups.forEach((group) => {
        if (group.id === groupedTabs[host][0].groupId && group.title === host) {
          groupExists = true;
        }
      });

      if (!groupExists) {
        chrome.tabs.group(
          {
            tabIds: [tabId],
          },
          (groupId) => {
            chrome.tabGroups.update(groupId, {
              title: host,
            });
          }
        );
      } else {
        chrome.tabs.group({
          tabIds: [tabId],
          groupId: groupedTabs[host][0].groupId,
        });
      }
    }
  });
});

// 构建标签页分组器
function tabGrouper(bookmarkTreeNodes, alltabs) {
  // 创建搜索框
  const createSearchBox = (bookmarkTreeNodes, alltabs) => {
    const searchBox = document.createElement("div");
    searchBox.id = "tab-grouper";
    const shadow = searchBox.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
    #container {
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background-color: rgba(249, 249, 249, 0.9);
      border: 1px solid #ccc;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 6px 12px rgba(0,0,0,0.3);
      width: 40%;
      height: 50%;
      display: flex;
      font-family: sans-serif;
      font-size: 14px;
    }
    #lists {
      display: flex;
      flex-direction: row;
      flex: 1;
      overflow: auto;
      flex-direction: column;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      box-sizing: border-box;
      background-color: rgba(255, 255, 255, 0);
      margin-bottom: 15px;
    }
    ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
      max-height: 100%;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    a {
      display: flex;
      align-items: center;
      padding: 5px 0;
      color: #000;
      text-decoration: none;
      border-bottom: 1px solid #ddd;
    }
    img {
      width: 16px;
      height: 16px;
      margin-right: 5px;
    }
  `;

    const container = document.createElement("div");
    container.id = "container";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search...";

    const listsContainer = document.createElement("div");
    listsContainer.id = "lists";

    const bookmarkList = document.createElement("ul");
    const tabList = document.createElement("ul");
    tabList.style.marginLeft = "20px";

    // 显示分组的标签页
    const groupedTabs = groupTabsByHost(alltabs);
    displayGroupedTabs(groupedTabs, tabList);

    // 监听输入以过滤书签
    input.addEventListener("input", () => {
      const query = input.value.toLowerCase();
      filterBookmarks(query, bookmarkTreeNodes, bookmarkList);
    });

    // 显示书签
    displayBookmarks(bookmarkTreeNodes, bookmarkList);

    listsContainer.appendChild(input);
    listsContainer.appendChild(bookmarkList);

    container.appendChild(listsContainer);
    container.appendChild(tabList);

    shadow.appendChild(style);
    shadow.appendChild(container);
    document.body.appendChild(searchBox);
    input.focus();

    // 监听Esc键关闭搜索框
    document.addEventListener("keydown", function escListener(event) {
      if (event.key === "Escape") {
        searchBox.remove();
        document.removeEventListener("keydown", escListener);
      }
    });
  };

  // 分组标签页
  const groupTabsByHost = (tabs) => {
    const groupedTabs = {};
    tabs.forEach((tab) => {
      try {
        const url = new URL(tab.url);
        let host = url.hostname.split(".")[0];
        if (host == "www") {
          host = url.hostname.split(".")[1];
        }
        if (!groupedTabs[host]) {
          groupedTabs[host] = [];
        }
        groupedTabs[host].push(tab);
      } catch (e) {
        console.log("Invalid URL:", tab.url);
      }
    });
    return groupedTabs;
  };

  // 显示分组的标签页
  const displayGroupedTabs = (groupedTabs, parentElement) => {
    parentElement.innerHTML = ""; // 清空当前列表内容

    const icons = [
      "🌟",
      "🚀",
      "📚",
      "🎨",
      "🎵",
      "📷",
      "💼",
      "🔧",
      "🔍",
      "🍀",
      "🔥",
      "🌈",
      "⚡",
      "🌍",
      "🌙",
      "☀️",
      "🌊",
      "🍎",
      "🍔",
      "🎁",
      "🎉",
      "🎈",
      "🎯",
      "🏆",
      "🏠",
      "🚗",
      "✈️",
      "🛒",
      "💡",
    ];
    Object.keys(groupedTabs).forEach((host) => {
      const hostItem = document.createElement("li");
      const hostTitle = document.createElement("span");
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];
      hostTitle.textContent = `${randomIcon} ${host}`;
      hostTitle.style.fontWeight = "bold";
      hostTitle.style.cursor = "pointer";
      hostTitle.style.display = "block";
      hostTitle.style.padding = "5px 0";
      hostTitle.style.borderBottom = "1px solid #ddd";
      hostTitle.style.color = "#FF4500";

      const subList = document.createElement("ul");
      subList.style.listStyleType = "none";
      subList.style.paddingLeft = "20px";
      subList.style.display = "block";

      hostTitle.addEventListener("click", () => {
        subList.style.display =
          subList.style.display === "none" ? "block" : "none";
      });

      groupedTabs[host].forEach((tab) => {
        const listItem = document.createElement("li");
        listItem.style.display = "flex";
        listItem.style.alignItems = "center";

        // 添加精致小巧的圆形删除按钮
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "✖";
        deleteButton.style.marginRight = "10px";
        deleteButton.style.border = "none";
        deleteButton.style.background = "transparent";
        deleteButton.style.color = "#888"; // 灰色
        deleteButton.style.cursor = "pointer";
        deleteButton.style.fontSize = "12px";
        deleteButton.style.padding = "0";
        deleteButton.style.width = "20px";
        deleteButton.style.height = "20px";
        deleteButton.style.borderRadius = "50%";
        deleteButton.style.display = "flex";
        deleteButton.style.justifyContent = "center";
        deleteButton.style.alignItems = "center";
        deleteButton.style.backgroundColor = "#f0f0f0"; // 背景灰色

        deleteButton.addEventListener("click", (event) => {
          event.stopPropagation();
          chrome.runtime.sendMessage(
            {
              action: "removeTab",
              tabId: tab.id,
            },
            () => {
              const openBox = document.getElementById("tab-grouper");
              if (openBox) {
                openBox.remove();
              }
              // 重新查询所有标签页并刷新列表
              chrome.runtime.sendMessage({
                action: "refreshGroupedTabs",
              });
            }
          );
        });

        const link = document.createElement("a");
        link.href = tab.url;
        link.textContent = tab.title || "无标题标签页";
        link.style.flex = "1";
        link.style.display = "flex";
        link.style.alignItems = "center";
        link.style.padding = "5px 0";
        link.style.color = "#000";
        link.style.textDecoration = "none";
        link.style.borderBottom = "1px solid #ddd";

        const icon = document.createElement("img");
        icon.src = getFaviconUrl(tab.url);
        icon.style.width = "16px";
        icon.style.height = "16px";
        icon.style.marginRight = "5px";
        icon.onerror = () => {
          icon.style.display = "none";
          const starIcon = document.createElement("span");
          starIcon.textContent = "🔍";
          starIcon.style.marginRight = "5px";
          link.prepend(starIcon);
        };

        link.prepend(icon);

        link.addEventListener("click", (event) => {
          event.preventDefault();
          chrome.runtime.sendMessage({
            action: "activateTab",
            tabId: tab.id,
          });
          const openBox = document.getElementById("tab-grouper");
          if (openBox) {
            openBox.remove();
          }
        });

        listItem.appendChild(deleteButton); // 将删除按钮添加到列表项的最前面
        listItem.appendChild(link);
        subList.appendChild(listItem);
      });

      hostItem.appendChild(hostTitle);
      hostItem.appendChild(subList);
      parentElement.appendChild(hostItem);
    });
  };

  // 获取网站图标URL
  const getFaviconUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.origin}/favicon.ico`;
    } catch (e) {
      const defaultFavicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
      return defaultFavicon;
    }
  };

  // 过滤书签
  const filterBookmarks = (query, nodes, parentElement) => {
    parentElement.innerHTML = "";
    let hasMatches = false;
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
          hasMatches = true;
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
        icon.src = getFaviconUrl(node.url);
        icon.style.width = "16px";
        icon.style.height = "16px";
        icon.style.marginRight = "5px";
        icon.onerror = () => {
          icon.style.display = "none";
          const starIcon = document.createElement("span");
          starIcon.textContent = "⭐️";
          starIcon.style.marginRight = "5px";
          link.prepend(starIcon);
        };

        link.prepend(icon);

        link.addEventListener("click", (event) => {
          event.preventDefault();
          window.open(link.href, "_blank");
          const openBox = document.getElementById("tab-grouper");
          if (openBox) {
            openBox.remove();
          }
        });

        listItem.appendChild(link);
        parentElement.appendChild(listItem);
        hasMatches = true;
      }
    });
    return hasMatches;
  };

  // 显示书签
  const displayBookmarks = (nodes, parentElement) => {
    nodes.forEach((node) => {
      const listItem = document.createElement("li");
      if (node.children) {
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
        folderText.style.color = "blue";

        folderTitle.appendChild(folderIcon);
        folderTitle.appendChild(folderText);

        const subList = document.createElement("ul");
        subList.style.listStyleType = "none";
        subList.style.paddingLeft = "20px";
        subList.style.display = "block";

        folderText.addEventListener("click", () => {
          subList.style.display =
            subList.style.display === "none" ? "block" : "none";
        });

        listItem.appendChild(folderTitle);
        listItem.appendChild(subList);
        displayBookmarks(node.children, subList);
      } else {
        const link = document.createElement("a");
        link.href = node.url;
        link.textContent = node.title || "无标题书签";
        link.style.display = "flex";
        link.style.alignItems = "center";
        link.style.padding = "5px 0";
        link.style.color = "black";
        link.style.textDecoration = "none";
        link.style.borderBottom = "1px solid #ddd";

        const icon = document.createElement("img");
        icon.src = getFaviconUrl(node.url);
        icon.style.width = "16px";
        icon.style.height = "16px";
        icon.style.marginRight = "5px";
        icon.onerror = () => {
          icon.style.display = "none";
          const starIcon = document.createElement("span");
          starIcon.textContent = "⭐️";
          starIcon.style.marginRight = "5px";
          link.prepend(starIcon);
        };

        link.prepend(icon);

        link.addEventListener("click", (event) => {
          event.preventDefault();
          window.open(link.href, "_blank");
          const openBox = document.getElementById("tab-grouper");
          if (openBox) {
            openBox.remove();
          }
        });

        listItem.appendChild(link);
      }
      parentElement.appendChild(listItem);
    });
  };

  const existingBox = document.getElementById("tab-grouper");
  if (existingBox) {
    existingBox.remove();
  } else {
    createSearchBox(bookmarkTreeNodes, alltabs);
  }
}
