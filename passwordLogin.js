import { printBlue, printGreen, printRed, printYellow } from "./utils/colorOut.js";
import { maskIdentifier, summarizeResponse } from "./utils/safeLog.js";
import { close_api, delay, startService } from "./utils/utils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERINFO_PATH = path.join(__dirname, "userinfo.json");
const ACCOUNTS_PATH = path.join(__dirname, "accounts.json");

async function login() {
  const APPEND_USER = process.env.APPEND_USER || "否";

  // 从 accounts.json 读取账号密码
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    throw new Error("未找到 accounts.json，请先创建并填入账号密码");
  }
  const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"));

  if (!accounts.length) {
    throw new Error("accounts.json 为空");
  }

  // 读取已有的 userinfo
  let userinfo = [];
  if (fs.existsSync(USERINFO_PATH)) {
    const raw = fs.readFileSync(USERINFO_PATH, "utf8");
    userinfo = JSON.parse(raw);
  }

  // 启动服务
  const api = startService();
  await delay(2000);

  try {
    for (let i = 0; i < accounts.length; i++) {
      const { username, password } = accounts[i];

      printYellow(`\n📱 正在登录第 ${i + 1}/${accounts.length} 个账号: ${maskIdentifier(username)}`);

      // 账号密码登录请求
      const result = await fetch("http://127.0.0.1:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }).then((r) => r.json());

      if (result?.status === 1) {
        printGreen("登录成功！");

        const userid = result.data?.userid || result.data?.user?.id;
        const token = result.data?.token;

        if (!userid || !token) {
          printRed("登录响应缺少 userid 或 token");
          continue;
        }

        let userAlreadyExist = false;

        if (APPEND_USER === "是") {
          for (let j = 0; j < userinfo.length; j++) {
            if (userinfo[j].userid == userid) {
              userAlreadyExist = true;
              printYellow(`userid: ${maskIdentifier(userinfo[j].userid)} 此账号已存在，仅更新 token`);
              userinfo[j].token = token;
            }
          }
        }

        if (!userAlreadyExist) {
          userinfo.push({ userid, token });
          printGreen(`已添加账号: ${maskIdentifier(userid)}`);
        }
      } else {
        printRed(`账号 ${maskIdentifier(username)} 登录失败：`);
        console.dir(summarizeResponse(result), { depth: null });
      }
    }

    if (userinfo.length) {
      fs.writeFileSync(USERINFO_PATH, JSON.stringify(userinfo, null, 2));
      printGreen("\n✅ 已写入 userinfo.json");
      printYellow("注意：userinfo.json 包含登录 token，请勿泄露");
      printBlue(JSON.stringify(userinfo, null, 2));
    }
  } finally {
    close_api(api);
  }

  if (api.killed) {
    process.exit(0);
  }
}

login();
