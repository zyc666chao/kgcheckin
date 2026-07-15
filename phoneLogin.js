import { printBlue, printGreen, printRed, printYellow } from "./utils/colorOut.js";
import { maskIdentifier, sanitizeForLog, shouldPrintSensitiveValue, summarizeResponse } from "./utils/safeLog.js";
import { close_api, delay, send, startService } from "./utils/utils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERINFO_PATH = path.join(__dirname, "userinfo.json");

async function login() {

  const phone = process.env.PHONE;
  const code = process.env.CODE;
  const APPEND_USER = process.env.APPEND_USER || "否";

  // 不使用二维码登录并且没有手机号或验证码
  if (!phone || !code) {
    throw new Error("未配置 PHONE 或 CODE");
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
    // 手机号登录请求
    const result = await send(`/login/cellphone?mobile=${phone}&code=${code}`, "GET", {});
    if (result.status === 1) {

      let userAlreadyExist = false;
      printGreen("登录成功！");
      if (APPEND_USER == "是") {
        for (let i = 0; i < userinfo.length; i++) {

          if (userinfo[i].userid == result.data.user.id) {
            userAlreadyExist = true;
            printYellow(`userid: ${maskIdentifier(userinfo[i].userid)} 此账号已存在, 仅更新登录信息`);
            userinfo[i].token = result.data.token;
          }
        }
      }
      if (!userAlreadyExist) {
        const _userid = result.data.user?.id || result.data.userid || result.data.user_id || result.data.uid;
        const _token = result.data.token || result.data.vip_token;
        if (!_userid || !_token) {
          printRed("登录响应字段异常，无法提取 userid/token");
          console.dir(summarizeResponse(result), { depth: null });
          throw new Error("登录响应字段异常");
        }
        userinfo.push({
          userid: _userid,
          token: _token,
        });
      }
      if (userinfo.length) {
        // 写入 userinfo.json
        fs.writeFileSync(USERINFO_PATH, JSON.stringify(userinfo, null, 2));
        printGreen("已写入 userinfo.json");
        printYellow("注意：userinfo.json 包含登录 token，请勿泄露");
        printBlue(JSON.stringify(userinfo, null, 2));
      }
    } else if (result.error_code === 34175) {
      throw new Error("暂不支持多账号绑定手机登录");
    } else {
      printRed("响应内容");
      console.dir(summarizeResponse(result), { depth: null });
      throw new Error("登录失败！请检查");
    }
  } finally {
    close_api(api);
  }

  if (api.killed) {
    process.exit(0);
  }
}

login();
