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
  const CODE = process.env.CODE || "";

  if (!CODE) {
    throw new Error("未配置 CODE（验证码），请在 Secrets 中设置 CODE=验证码1,验证码2");
  }

  if (!fs.existsSync(ACCOUNTS_PATH)) {
    throw new Error("accounts.json 不存在！");
  }
  const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"));
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("accounts.json 中没有账号！");
  }

  const codes = CODE.split(",");

  // 读取已有的 userinfo
  let userinfo = [];
  if (fs.existsSync(USERINFO_PATH)) {
    const raw = fs.readFileSync(USERINFO_PATH, "utf8");
    userinfo = JSON.parse(raw);
  }

  // 启动服务（lite 模式）
  const api = startService();
  await delay(2000);

  try {
    for (let i = 0; i < accounts.length; i++) {
      const { username: phone } = accounts[i];
      const code = codes[i] || codes[codes.length - 1];

      if (!code || code.trim() === "") {
        printRed(`第 ${i + 1} 个账号 ${maskIdentifier(phone)} 缺少验证码，跳过`);
        continue;
      }

      printYellow(`\n🔐 正在登录第 ${i + 1}/${accounts.length} 个账号: ${maskIdentifier(phone)}`);
      printYellow(`验证码: ${code}`);

      const result = await fetch("http://127.0.0.1:3000/login/cellphone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: phone, code, platform: "lite" }),
      }).then((r) => r.json());

      if (result?.status === 1) {
        printGreen("登录成功！");

        const userid = result.data?.userid;
        const token = result.data?.token;

        if (!userid || !token) {
          printRed("登录响应缺少 userid 或 token");
          console.dir(summarizeResponse(result), { depth: null });
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
        printRed(`账号 ${maskIdentifier(phone)} 登录失败：`);
        console.dir(summarizeResponse(result), { depth: null });
      }

      // 避免请求过快
      await delay(1500);
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
