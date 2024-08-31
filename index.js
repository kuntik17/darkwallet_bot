require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const token = process.env.TG_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const welcomeMessageTemplate = (username) => `
Hey @${username}!

Welcome to Waifu Simulator, where you head pat and earn affection points!

Here’s what’s waiting for you:

💖 Endless Head Pats for Endless Love: Pat your waifu's head as much as you can to build up affection points

🎁 Gift Your Waifu: Spend your affection points on gifts to unlock new upgrades for your waifu.

👫 Invite Your Friends: Bring your friends into the game and earn bonus affection points for each new player.

Ready to charm your way to your waifu's heart? Click the "Start Playing" button below and let the romance begin. 💕`;

const generateOptions = (referralCode) => {
  const inlineKeyboard = [
    [{ text: "Start Playing 🌺", web_app: { url: process.env.WEB_APP_URL } }],
    [{ text: "Subscribe to channel", url: "https://t.me/wtfwaifugroup" }],
    [{ text: "Follow on X", url: "https://twitter.com/WaifuWTF" }],
  ];

  if (referralCode) {
    inlineKeyboard.push([{ text: "Invite Friends", callback_data: `invite_${referralCode}` }]);
  }

  return {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  };
};

bot.onText(/\/start$/, async (msg) => {
  console.log("Chat starts without referral");
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || "there";
  const referralCode = await checkUser(chatId, username, null);
  const welcomeMessage = welcomeMessageTemplate(username);
  bot.sendMessage(chatId, welcomeMessage, generateOptions(referralCode));
});

bot.onText(/\/start (.+)/, async (msg, match) => {
  console.log("Chat starts with referral");
  const chatId = msg.chat.id;
  const referralId = match[1];
  const username = msg.from.username || msg.from.first_name || "there";
  const referralCode = await checkUser(chatId, username, referralId);
  const welcomeMessage = welcomeMessageTemplate(username);
  bot.sendMessage(chatId, welcomeMessage, generateOptions(referralCode));
});

const checkUser = async (chatId, username, referralId) => {
  const { data, error } = await supabase.from("wtf_users").select("referral_code").eq("telegram_id", chatId);

  if (error) {
    console.error("Error fetching user:", error);
    return null;
  }

  if (data && data.length > 0) {
    console.log("User exists");
    const referralCode = data[0].referral_code;
    console.log("Referral code:", referralCode);
    return referralCode;
  } else {
    let isReferralValid = false;
    if (referralId) {
      // First check if referral exists and not belong to the same user
      const { data: referralData, error: referralError } = await supabase.from("wtf_users").select("telegram_id").eq("referral_code", referralId);

      if (referralError) {
        console.error("Error fetching referral:", referralError);
      }

      if (referralData && referralData.length > 0) {
        const referralUserId = referralData[0].telegram_id;
        if (referralUserId !== chatId) {
          isReferralValid = true;
        }
      }
    }

    const { data: createData, error: createError } = await supabase
      .from("wtf_users")
      .insert([
        {
          telegram_id: chatId,
          telegmra_username: username,
          email: `${chatId}@telegram.com`,
          referral: isReferralValid,
        },
      ])
      .select(); // This line retrieves the inserted row

    if (createError) {
      console.error("Error creating user:", createError);
      return null;
    }

    const referralCode = createData[0].referral_code;
    console.log("Create result:", createData);

    if (isReferralValid) {
      const { error: inviteError } = await supabase.from("wtf_referral").insert([
        {
          telegram_id: chatId,
          referral: referralId,
        },
      ]);

      if (inviteError) {
        console.error("Error creating referral:", inviteError);
      } else {
        console.log("Invite result: Success");
      }
    }

    return referralCode;
  }
};

bot.on("message", function (msg) {
  console.log(msg);
});

bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const message = callbackQuery.message;
  if (data.startsWith("invite_")) {
    const referralCode = data.split("_")[1];
    const referralLink = `${process.env.TELEGRAM_LINK}?start=${referralCode}`;
    await bot.sendMessage(message.chat.id, `Invite your friends using this link: ${referralLink}`);
    await bot.answerCallbackQuery(callbackQuery.id);
  }
});
