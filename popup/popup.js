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

    // 按 name 进行分类
    const categories = {};
    for (const [host, name] of Object.entries(supportedHosts)) {
      if (!categories[name]) {
        categories[name] = [];
      }
      categories[name].push(host);
    }

    // 创建分类列表
    for (const [name, hosts] of Object.entries(categories)) {
      const categoryDiv = document.createElement("div");
      categoryDiv.className = "category";

      const categoryTitle = document.createElement("h3");
      categoryTitle.textContent = name;
      categoryDiv.appendChild(categoryTitle);

      const categoryList = document.createElement("ul");

      hosts.forEach((host) => {
        const listItem = document.createElement("li");

        // 创建一个 span 来包含文本内容
        const textSpan = document.createElement("span");
        textSpan.className = "text-span";

        // 分别创建 host 和 name 的显示元素
        const hostSpan = document.createElement("span");
        hostSpan.className = "host-span";
        hostSpan.textContent = host;

        const separator = document.createElement("span");
        separator.className = "separator";
        separator.textContent = "<=>";

        const nameSpan = document.createElement("span");
        nameSpan.className = "name-span";
        nameSpan.textContent = name;

        // 将所有元素添加到 textSpan
        textSpan.appendChild(hostSpan);
        textSpan.appendChild(separator);
        textSpan.appendChild(nameSpan);

        // 修改删除按钮的样式
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "✖";

        // 添加删除功能
        deleteButton.addEventListener("click", () => {
          delete supportedHosts[host];
          saveHosts(supportedHosts);
          displayHosts();
        });

        listItem.appendChild(deleteButton);
        listItem.appendChild(textSpan);
        categoryList.appendChild(listItem);
      });

      categoryDiv.appendChild(categoryList);
      hostList.appendChild(categoryDiv);
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

    // 显示成功消息
    const message = document.getElementById("message");
    message.textContent = "Host and name set successfully!";
    message.style.display = "block";

    // 3秒后隐藏消息
    setTimeout(() => {
      message.style.display = "none";
    }, 2000);
  }
});

// 初始化显示
displayHosts();