const groupTabsByHost = async (tabs) => {
  const groupedTabs = {};

  // 使用 for...of 替代 forEach 以正确处理异步操作
  for (const tab of tabs) {
    try {
      const url = new URL(tab.url);
      let host = url.hostname.split(".")[0];
      if (host == "www") {
        host = url.hostname.split(".")[1];
      }

      const supportedHosts = await chrome.storage.local.get("supportedHosts");
      if (supportedHosts?.supportedHosts) {
        for (const [key, value] of Object.entries(
          supportedHosts.supportedHosts
        )) {
          if (tab.url.includes(key)) {
            host = value;
            break;
          }
        }
      }

      if (!groupedTabs[host]) {
        groupedTabs[host] = [];
      }
      groupedTabs[host].push(tab);
    } catch (e) {
      console.log("Invalid URL:", tab.url);
    }
  }

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
  } else if (request.action === "search") {
    searchTabsAndBookmarks(request.query)
      .then((results) => sendResponse(results))
      .catch((error) => console.error("搜索错误:", error));
    return true; // 保持消息通道开放以进行异步响应
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
  chrome.tabs.query({}, async () => {
    if (changeInfo.status === "complete") {
      // generate host
      const supportedHosts = await chrome.storage.local.get("supportedHosts");
      const url = new URL(tab.url);
      let host = url.hostname.split(".")[0];
      if (host == "www") {
        host = url.hostname.split(".")[1];
      }

      if (supportedHosts != undefined) {
        // 修改成 URL 包含 supportedHosts 的 host
        for (const [key, value] of Object.entries(
          supportedHosts.supportedHosts
        )) {
          if (tab.url.includes(key)) {
            host = value;
            break;
          }
        }
      }

      var groupExists = false;
      var existGroupID = 0;
      // 使用 await 等待 Promise 完成
      const groups = await chrome.tabGroups.query({});
      groups.forEach((group) => {
        if (group.title === host) {
          groupExists = true;
          existGroupID = group.id;
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
          groupId: existGroupID,
        });
      }
    }
  });
});

// 构建标签页分组器
async function tabGrouper(bookmarkTreeNodes, alltabs) {
  // 创建搜索框
  const createSearchBox = async (bookmarkTreeNodes, alltabs) => {
    const searchBox = document.createElement("div");
    searchBox.id = "tab-grouper";
    const shadow = searchBox.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #333;
    }
    
    #container {
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background-color: #ffffff;
      border: 1px solid #ccc;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 6px 12px rgba(0,0,0,0.3);
      width: 40%;
      min-width: 600px;
      height: 50%;
      min-height: 400px;
      display: flex;
      flex-direction: column;
      font-size: 14px !important;
      line-height: 1.4 !important;
    }
    
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      box-sizing: border-box;
      background-color: #ffffff !important;
      margin-bottom: 15px;
      font-size: 14px !important;
      outline: none;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      opacity: 1 !important;
    }
    
    input::placeholder {
      color: #999999 !important;
      -webkit-text-fill-color: #999999 !important;
      opacity: 1 !important;
    }
    
    input:focus {
      border-color: #4a90e2;
      box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    
    #lists {
      display: flex;
      flex-direction: row;
      flex: 1;
      overflow: auto;
      gap: 20px;
    }
    
    ul {
      list-style-type: none !important;
      padding: 0 !important;
      margin: 0 !important;
      max-height: 100%;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    a {
      display: flex !important;
      align-items: center !important;
      padding: 5px 0 !important;
      color: #333 !important;
      text-decoration: none !important;
      border-bottom: 1px solid #ddd !important;
      font-size: 14px !important;
    }
    
    a:hover {
      background-color: rgba(74, 144, 226, 0.1);
    }
    
    img {
      width: 16px !important;
      height: 16px !important;
      margin-right: 5px !important;
      flex-shrink: 0 !important;
    }
    
    button {
      all: unset;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: #f0f0f0;
      color: #666;
      font-size: 12px;
      margin-right: 8px;
      transition: all 0.2s;
    }
    
    button:hover {
      background-color: #e0e0e0;
      color: #333;
    }
    
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #999;
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
    const groupedTabs = await groupTabsByHost(alltabs);
    displayGroupedTabs(groupedTabs, tabList);

    // 监听输入以过滤书签
    input.addEventListener("input", async () => {
      const query = input.value.toLowerCase();
      if (query) {
        chrome.runtime.sendMessage(
          { action: "search", query: query },
          async (results) => {
            const tabs = results.filter((item) => item.type === "tab");
            const bookmarks = results.filter(
              (item) => item.type === "bookmark"
            );

            // 更新标签页列表，保持分组显示
            const groupedTabs = await groupTabsByHost(tabs);
            displayGroupedTabs(groupedTabs, tabList);

            // 更新书签列表，显示完整路径
            bookmarkList.innerHTML = "";
            displayBookmarks(bookmarks, bookmarkList, true); // true 表示这是搜索结果
          }
        );
      } else {
        displayGroupedTabs(await groupTabsByHost(alltabs), tabList);
        displayBookmarks(bookmarkTreeNodes, bookmarkList);
      }
    });

    // 显示书签
    displayBookmarks(bookmarkTreeNodes, bookmarkList);

    listsContainer.appendChild(bookmarkList);
    listsContainer.appendChild(tabList);

    container.appendChild(input);
    container.appendChild(listsContainer);

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
  const groupTabsByHost = async (tabs) => {
    const groupedTabs = {};

    // 使用 for...of 替代 forEach 以正确处理异步操作
    for (const tab of tabs) {
      try {
        const url = new URL(tab.url);
        let host = url.hostname.split(".")[0];
        if (host == "www") {
          host = url.hostname.split(".")[1];
        }

        const supportedHosts = await chrome.storage.local.get("supportedHosts");
        if (supportedHosts?.supportedHosts) {
          for (const [key, value] of Object.entries(
            supportedHosts.supportedHosts
          )) {
            if (tab.url.includes(key)) {
              host = value;
              break;
            }
          }
        }

        if (!groupedTabs[host]) {
          groupedTabs[host] = [];
        }
        groupedTabs[host].push(tab);
      } catch (e) {
        console.log("Invalid URL:", tab.url);
      }
    }

    return groupedTabs;
  };

  // 显示分组的标签页
  const displayGroupedTabs = (groupedTabs, parentElement) => {
    parentElement.innerHTML = "";
    if (Object.keys(groupedTabs).length === 0) {
      const noResults = document.createElement("li");
      noResults.textContent = "No matching tab found.";
      noResults.style.padding = "10px";
      noResults.style.color = "#666";
      parentElement.appendChild(noResults);
      return;
    }

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

  // 过滤签
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
  const displayBookmarks = (
    nodes,
    parentElement,
    isSearchResult = false,
    level = 0
  ) => {
    parentElement.innerHTML = "";

    if (
      nodes.length === 0 ||
      (nodes[0].children && nodes[0].children.length === 0)
    ) {
      const noResults = document.createElement("li");
      noResults.textContent = "No matching bookmarks found.";
      noResults.style.padding = "10px";
      noResults.style.color = "#666";
      parentElement.appendChild(noResults);
      return;
    }

    nodes.forEach((node) => {
      const listItem = document.createElement("li");
      listItem.style.marginLeft = `${level * 5}px`; // 每个层级缩进5px

      if (isSearchResult && node.path) {
        const pathElement = document.createElement("div");
        pathElement.style.fontSize = "12px";
        pathElement.style.color = "#666";
        pathElement.style.marginBottom = "3px";
        pathElement.textContent = `📂 ${node.path.join(" > ")}`;
        listItem.appendChild(pathElement);
      }

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
        subList.style.padding = "0"; // 移除默认padding
        subList.style.display = "block";

        folderText.addEventListener("click", () => {
          subList.style.display =
            subList.style.display === "none" ? "block" : "none";
        });

        listItem.appendChild(folderTitle);
        listItem.appendChild(subList);
        displayBookmarks(node.children, subList, false, level + 1); // 递归调用时增加层级
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

async function searchTabsAndBookmarks(query) {
  // 搜索标签页
  const tabs = await chrome.tabs.query({});
  const matchedTabs = tabs.filter(
    (tab) =>
      tab.title.toLowerCase().includes(query.toLowerCase()) ||
      tab.url.toLowerCase().includes(query.toLowerCase())
  );

  const groupedTabs = await groupTabsByHost(tabs);
  Object.keys(groupedTabs).forEach((host) => {
    if (host.toLowerCase().includes(query.toLowerCase())) {
      matchedTabs.push(...groupedTabs[host]);
    }
  });

  // 搜索收藏夹并保持完整路径
  const bookmarks = await chrome.bookmarks.search(query);
  const bookmarksWithPath = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const path = await getBookmarkPath(bookmark.id);
      return {
        type: "bookmark",
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        path: path, // 包含完整的文件夹路径
      };
    })
  );

  // 合并结果
  const results = [
    ...matchedTabs.map((tab) => ({
      type: "tab",
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      groupId: tab.groupId, // 保存标签页组ID
    })),
    ...bookmarksWithPath,
  ];

  return results;
}

// 添加获取书签路径的辅助函数
async function getBookmarkPath(bookmarkId) {
  const getNode = async (id) => {
    const nodes = await chrome.bookmarks.get(id);
    return nodes[0];
  };

  const path = [];
  let currentNode = await getNode(bookmarkId);

  while (currentNode.parentId) {
    currentNode = await getNode(currentNode.parentId);
    if (currentNode.title) {
      path.unshift(currentNode.title);
    }
  }

  return path;
}
