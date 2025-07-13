require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { Client } = require("@line/bot-sdk");
const fetch = require("node-fetch");
const app = express();
const port = process.env.PORT || 3000;

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);
app.use(bodyParser.json());

const LANG_MAP = {
  DM1: "C", // 中文
  DM2: "D", // 英文
  DM3: "E", // 越南
  DM4: "F", // 泰文
  DM5: "G", // 柬埔寨
  DM6: "H", // 印尼
  DM7: "I", // 西文
};

app.post("/webhook", async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const groupId = event.source && event.source.groupId ? event.source.groupId : null;
      const message = event.message.text;

      if (message === "/獲取群組ID") {
        const replyText = groupId
          ? `群組 ID 是：${groupId}`
          : "無法獲取群組 ID，請在群組中使用此指令。";
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: replyText,
        });
      }

      if (message === "點名提醒") {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL + "?getText=1";
        try {
          const response = await fetch(scriptUrl);
          const text = await response.text();
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: text.length > 4000 ? text.slice(0, 3990) + "（內容過長已截斷）" : text,
          });
        } catch (error) {
          console.error("取得點名提醒失敗：", error);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "取得點名提醒失敗，請稍後再試。",
          });
        }
      }
      if (message === "/") {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL + "?getText=1";
        try {
          const response = await fetch(scriptUrl);
          const text = await response.text();
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: text.length > 4000 ? text.slice(0, 3990) + "（內容過長已截斷）" : text,
          });
        } catch (error) {
          console.error("取得點名提醒失敗：", error);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "取得點名提醒失敗，請稍後再試。",
          });
        }
      }
      // 處理 /DM1 ~ /DM7
      if (/^\/DM[1-7]$/.test(message)) {
        const langKey = message.replace("/", "");
        const langCol = LANG_MAP[langKey];
        const scriptUrl = `${process.env.GOOGLE_SCRIPT_URL_DM}?col=${langCol}`;
        try {
          const response = await fetch(scriptUrl);
          const data = await response.json();  // 假設返回的是 JSON 格式的資料
          const { imageId, imageType, textMessage } = data;  // 假設返回的是 imageId, imageType 和 textMessage

          const messages = [];

          // 檢查是否有圖片
          if (imageId && imageId.startsWith("http")) {
            messages.push({
              type: imageType || "image",  // 如果返回的有圖片類型，則使用它
              originalContentUrl: imageId,
              previewImageUrl: imageId,
            });
          }

          // 檢查是否有文字訊息
          if (textMessage) {
            messages.push({
              type: "text",
              text: textMessage,
            });
          }

          if (messages.length > 0) {
            await client.replyMessage(event.replyToken, messages);
          } else {
            throw new Error("沒有有效的圖像或文字回覆");
          }
        } catch (error) {
          console.error(`取得 ${message} 圖片或文字失敗：`, error);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `取得 ${message} 圖片或文字失敗，請稍後再試。`,
          });
        }
      }
    }
  }
  res.sendStatus(200);
});


// 處理 Google Script 的推送
app.post("/sendReminder", async (req, res) => {
  try {
    const { groupId, content, type = "text" } = req.body;
    if (!groupId || !content) {
      res.status(400).send("缺少必要參數");
      return;
    }

    const validGroupId = String(groupId).trim();
    const validContent = String(content).trim();
    const validType = String(type).trim();

    let message;
    if (validType === "text") {
      message = { type: "text", text: validContent };
    } else if (validType === "image") {
      message = {
        type: "image",
        originalContentUrl: validContent,
        previewImageUrl: validContent,
      };
    } else {
      res.status(400).send("不支援的訊息類型");
      return;
    }

    await client.pushMessage(validGroupId, message);
    res.status(200).send("提醒已成功發送");
  } catch (error) {
    console.error("發送提醒錯誤：", error);
    res.status(500).send("伺服器錯誤");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
