var supportedHosts = {};

// 保存支持的 host name 列表到 localStorage
function saveHosts(hosts) {
  chrome.storage.local.set({ supportedHosts: hosts });
}

// 显示当前支持的 host name
function displayHosts() {
  chrome.storage.local.get("supportedHosts", (result) => {
    if (result.supportedHosts != undefined) {
      supportedHosts = result.supportedHosts;
    }
    const hostList = document.getElementById("hosts");
    hostList.innerHTML = ""; // 清空列表
    for (const [host, name] of Object.entries(supportedHosts)) {
      console.log(`${host} => ${name}`);
      const listItem = document.createElement("li");
      listItem.style.fontSize = "15px";
      listItem.style.display = "flex";
      listItem.style.alignItems = "center";
      listItem.style.padding = "8px 12px";
      listItem.style.borderBottom = "1px solid #eee";
      listItem.style.backgroundColor = "#fff";
      listItem.style.transition = "background-color 0.2s";

      // 创建一个 span 来包含文本内容
      const textSpan = document.createElement("span");
      textSpan.style.display = "flex";
      textSpan.style.alignItems = "center";
      textSpan.style.gap = "8px";

      // 分别创建 host 和 name 的显示元素
      const hostSpan = document.createElement("span");
      hostSpan.textContent = host;
      hostSpan.style.color = "#1a73e8"; // Google blue
      hostSpan.style.fontWeight = "500";

      const separator = document.createElement("span");
      separator.textContent = "<=>";
      separator.style.color = "#666";
      separator.style.fontSize = "14px";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = name;
      nameSpan.style.color = "#137333"; // Google green
      nameSpan.style.fontWeight = "500";

      // 将所有元素添加到 textSpan
      textSpan.appendChild(hostSpan);
      textSpan.appendChild(separator);
      textSpan.appendChild(nameSpan);

      // 修改删除按钮的样式
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "✖";
      deleteButton.style.marginRight = "12px";
      deleteButton.style.border = "none";
      deleteButton.style.background = "transparent";
      deleteButton.style.color = "#999";
      deleteButton.style.cursor = "pointer";
      deleteButton.style.fontSize = "14px";
      deleteButton.style.padding = "4px";
      deleteButton.style.width = "24px";
      deleteButton.style.height = "24px";
      deleteButton.style.borderRadius = "50%";
      deleteButton.style.display = "flex";
      deleteButton.style.justifyContent = "center";
      deleteButton.style.alignItems = "center";
      deleteButton.style.transition = "all 0.2s";

      // 添加删除功能
      deleteButton.addEventListener("click", () => {
        delete supportedHosts[host];
        saveHosts(supportedHosts);
        displayHosts();
      });

      // 添加悬停效果
      deleteButton.addEventListener("mouseover", () => {
        deleteButton.style.backgroundColor = "#ff4d4f";
        deleteButton.style.color = "#fff";
      });

      deleteButton.addEventListener("mouseout", () => {
        deleteButton.style.backgroundColor = "transparent";
        deleteButton.style.color = "#999";
      });

      listItem.addEventListener("mouseover", () => {
        listItem.style.backgroundColor = "#f5f5f5";
      });

      listItem.addEventListener("mouseout", () => {
        listItem.style.backgroundColor = "#fff";
      });

      listItem.appendChild(deleteButton);
      listItem.appendChild(textSpan);
      hostList.appendChild(listItem);
    }
  });
}

// 设置自定义 host name
document.getElementById("set-host").addEventListener("click", () => {
  const host = document.getElementById("host-input").value;
  const name = document.getElementById("name-input").value;
  console.log(`set ${host} => ${name}`);
  if (host.trim() != "" && name.trim() != "") {
    supportedHosts[host] = name;
    saveHosts(supportedHosts);
    displayHosts();
  }
});

// 初始化显示
displayHosts();
