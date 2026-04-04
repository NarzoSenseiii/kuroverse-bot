require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const prefix = ".";
const fs = require('fs');
const WARNS_FILE = './warnings.json';
const MARRY_FILE = './marriages.json';
const afkMap = new Map();
const cooldowns = new Map();

function loadWarns() {
  if (!fs.existsSync(WARNS_FILE)) return {};
  return JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
}
function saveWarns(data) {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2));
}

function loadMarriages() {
  if (!fs.existsSync(MARRY_FILE)) return {};
  return JSON.parse(fs.readFileSync(MARRY_FILE, 'utf8'));
}
function saveMarriages(data) {
  fs.writeFileSync(MARRY_FILE, JSON.stringify(data, null, 2));
}


// ─── MESSAGE TRACKING ────────────────────────────────────────
const MSG_FILE       = './messages.json';
const DAILY_MSG_FILE = './daily_messages.json';
const HONORED_ROLE_ID = '1489865370167939155';

function loadMsgData() {
  if (!fs.existsSync(MSG_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(MSG_FILE, 'utf8')); } catch { return {}; }
}
function saveMsgData(data) {
  fs.writeFileSync(MSG_FILE, JSON.stringify(data));
}
function loadDailyData() {
  if (!fs.existsSync(DAILY_MSG_FILE)) return { date: getTodayIST(), counts: {} };
  try { return JSON.parse(fs.readFileSync(DAILY_MSG_FILE, 'utf8')); } catch { return { date: getTodayIST(), counts: {} }; }
}
function saveDailyData(data) {
  fs.writeFileSync(DAILY_MSG_FILE, JSON.stringify(data));
}
function getTodayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseTime(time) {
  const num = parseInt(time);
  if (time.endsWith('s')) return num * 1000;
  if (time.endsWith('m')) return num * 60 * 1000;
  if (time.endsWith('h')) return num * 60 * 60 * 1000;
  if (time.endsWith('d')) return num * 24 * 60 * 60 * 1000;
  return null;
}

function makeDeleteBtn(invokerId) {
  return new ButtonBuilder()
    .setCustomId(`delete_msg_${invokerId}`)
    .setEmoji({ id: '1487069391987409010', name: 'delete' })
    .setStyle(ButtonStyle.Secondary);
}

function noPermsEmbed(action) {
  return new EmbedBuilder()
    .setColor(0xff3b3b)
    .setAuthor({ name: 'Missing Permissions' })
    .setDescription(
      `<:flash:1487027526394974218> **You do not have permission to \`${action}\` members.**\n\n` +
      `You need the appropriate moderator permissions to use this command.`
    )
    .setTimestamp();
}

function hierarchyEmbed(action) {
  return new EmbedBuilder()
    .setColor(0xff3b3b)
    .setAuthor({ name: 'Missing Permissions' })
    .setDescription(
      `<:flash:1487027526394974218> **You cannot \`${action}\` this member.**\n\n` +
      `Their role is equal to or higher than yours in the hierarchy.`
    )
    .setTimestamp();
}

async function resolveMember(guild, arg) {
  if (!arg) return null;

  // Try mention or raw ID first
  const idMatch = arg.match(/^<?@?!?(\d{17,19})>?$/);
  if (idMatch) {
    try { return await guild.members.fetch(idMatch[1]); } catch { return null; }
  }

  // Try username / display-name search (case-insensitive)
  const query = arg.toLowerCase();
  try {
    // Fetch all members so cache is warm (works for reasonably-sized servers)
    await guild.members.fetch();
    return guild.members.cache.find(m =>
      m.user.username.toLowerCase() === query ||
      m.user.tag.toLowerCase() === query ||
      (m.nickname && m.nickname.toLowerCase() === query)
    ) || null;
  } catch { return null; }
}

// ─── TRUTH & DARE DATA ───────────────────────────────────────
const truths = [
  "What's the most embarrassing thing you've ever done in public?",
  "Have you ever lied to get out of trouble? What was the lie?",
  "What's the most childish thing you still do?",
  "Have you ever blamed someone else for something you did?",
  "What's your biggest insecurity?",
  "Have you ever cheated on a test or game?",
  "What's the worst gift you've ever received and who gave it?",
  "Have you ever pretended to be sick to avoid something?",
  "What's the most embarrassing thing on your phone right now?",
  "Have you ever talked behind a friend's back?",
  "What's a secret you've never told anyone in this server?",
  "Have you ever ghosted someone? Why?",
  "What's the dumbest thing you've ever argued about?",
  "Have you ever eavesdropped on a private conversation?",
  "What's the longest you've gone without showering?",
  "Have you ever returned something after already using it?",
  "What's the most money you've spent on something you regret?",
  "Have you ever pretended to like a gift you hated?",
  "What's the most embarrassing thing you've googled?",
  "Have you ever laughed at the wrong moment?",
  "What's a habit you have that you're ashamed of?",
  "Have you ever fallen asleep during an important event?",
  "What's the worst excuse you've ever made up?",
  "Have you ever faked laughing at a joke you didn't understand?",
  "What's the most desperate thing you've done for attention?",
  "Have you ever read someone's messages without them knowing?",
  "What's the pettiest reason you've been upset with someone?",
  "Have you ever told a white lie that got out of hand?",
  "What's the most embarrassing nickname you've had?",
  "Have you ever walked into the wrong bathroom?",
  "What's something you pretend to know but actually don't?",
  "Have you ever cried at a movie or show but pretended you didn't?",
  "What's the most immature thing you've done recently?",
  "Have you ever eaten something off the floor?",
  "What's the worst thing you ever said to a friend?",
  "Have you ever accidentally sent a message to the wrong person?",
  "What's the most embarrassing photo of you that exists?",
  "Have you ever gotten lost somewhere embarrassingly simple?",
  "What's a show or movie you're ashamed to admit you loved?",
  "Have you ever made a promise you knew you wouldn't keep?",
  "What's the most ridiculous fear you have?",
  "Have you ever laughed so hard something came out of your nose?",
  "What's the worst fashion choice you've ever made?",
  "Have you ever tripped and fallen in front of people?",
  "What's the most embarrassing thing a family member has done?",
  "Have you ever made fun of someone and then felt terrible?",
  "What's the weirdest dream you remember having?",
  "Have you ever sent a message to the wrong group chat?",
  "What's a lie you've told so many times you almost believe it?",
  "Have you ever snuck food into a place you weren't supposed to?",
  "What's the most embarrassing auto-correct you've sent?",
  "Have you ever pretended to be busy to avoid someone?",
  "What's the pettiest revenge you've taken on someone?",
  "Have you ever laughed at your own joke when no one else did?",
  "What's the most embarrassing voicemail you've left?",
  "Have you ever told someone their cooking was great when it wasn't?",
  "What's the worst thing you've done when you were bored?",
  "Have you ever broken something and blamed it on someone else?",
  "What's the most awkward conversation you've had?",
  "Have you ever cried over something that wasn't worth it?",
  "What's something you've done that you hope no one finds out?",
  "Have you ever been caught snooping through someone's stuff?",
  "What's the most embarrassing thing you've done on social media?",
  "Have you ever skipped out on paying for something?",
  "What's the lamest excuse you've ever come up with?",
  "Have you ever been rejected and how did you handle it?",
  "What's the funniest misunderstanding you've been part of?",
  "Have you ever pretended to know a celebrity or famous person?",
  "What's the worst trouble you've gotten into as a kid?",
  "Have you ever screamed at a video game in public?",
  "What's the most ridiculous argument you've had with a sibling or friend?",
  "Have you ever been caught talking to yourself?",
  "What's the most embarrassing thing your parents have caught you doing?",
  "Have you ever made up a story to make yourself sound cooler?",
  "What's something you secretly judge people for?",
  "Have you ever forgotten someone's name right after being introduced?",
  "What's the most trouble you've caused without meaning to?",
  "If your life had a theme song, what would it be and why?",
  "What's the most irrational thing you genuinely believe?",
  "Have you ever pretended to understand something you had no clue about?",
  "What's a hobby or interest you hide from most people?",
  "Have you ever had a crush on someone wildly inappropriate?",
  "What's the meanest thought you've had about a stranger?",
  "Have you ever done something embarrassing while sleepwalking or half-asleep?",
  "What's the worst decision you've made on impulse?",
  "Have you ever wished you could take back something you said?",
  "What's the most shameful thing you've spent money on?",
  "Have you ever faked being good at something to impress someone?",
  "What's the strangest thing you've been obsessed with?",
  "Have you ever been more scared than you'd admit to a friend?",
  "What's the most ridiculous thing you've cried about?",
  "Have you ever done something dangerous and told no one?",
  "What's the biggest thing you've procrastinated on?",
  "Have you ever blamed a bad mood on something other than the real cause?",
  "What's a movie or book opinion you hold that most people would disagree with?",
  "Have you ever pretended to have plans to avoid going somewhere?",
  "What's the most unhinged thing you've typed and then deleted?",
  "Have you ever convinced yourself you were good at something you really weren't?",
  "What's the most embarrassing thing you've done to get someone's attention?",
  "Have you ever regretted telling someone a secret?",
  "What's the weirdest food combination you actually enjoy?",
  "Have you ever laughed at a completely inappropriate time?",
  "What's the most over-the-top reaction you've had to something minor?",
  "Have you ever done something embarrassing and immediately looked around to see if anyone saw?",
  "What's the most dramatic thing you've ever done over something small?",
  "Have you ever done a voice or impression without realizing people could hear you?",
  "What's your most controversial food opinion?",
  "Have you ever had an imaginary argument in your head that made you genuinely upset?",
  "What's the most embarrassing song you know every word to?",
  "Have you ever done something embarrassing and immediately walked away like nothing happened?",
  "What's the strangest thing you've argued about with yourself?",
  "Have you ever pretended to get a phone call to escape a conversation?",
  "What's the most random skill you have that serves no purpose?",
  "Have you ever talked to an inanimate object and genuinely expected a response?",
  "What's the most dramatic text you've ever typed and then deleted?",
  "Have you ever convinced yourself a mild inconvenience was a catastrophe?",
  "What's the weirdest thing you've done when home alone?",
  "Have you ever done something embarrassing in front of a pet?",
  "What's the most unnecessary thing you've ever bought?",
  "Have you ever spent hours doing something completely pointless and felt satisfied?",
];

const dares = [
  "Send a message to someone you haven't spoken to in months saying 'I miss you.'",
  "Send a voice message saying 'I am a professional cheese taster' in the most serious tone.",
  "Send a message to your best friend saying 'We need to talk' and wait for their reaction.",
  "Post the last thing you copy-pasted without checking what it is.",
  "Send a message to a family member asking for their favourite joke.",
  "Send a message to someone saying 'Can you keep a secret?' and leave them on read.",
  "Send 'brb, fighting a bear' to a random contact and show the reaction.",
  "Send a message to someone saying 'I just saw something that reminded me of you' and leave it at that.",
  "Send a sincere compliment to every person currently active in this server.",
  "Send a wholesome message to the person who most recently messaged in this chat.",
  "Send a voice message doing your best impression of a robot.",
  "Send a voice message speaking in the accent of a country the group picks.",
  "Send a voice message where you narrate everything around you like a nature documentary.",
  "Send a voice message giving a motivational speech about brushing your teeth.",
  "Send a voice message doing your best villain monologue.",
  "Send a voice message doing a weather forecast for your current location.",
  "Send a voice message telling a knock-knock joke the group picks.",
  "Send a voice message doing a fake advertisement for the last thing you bought.",
  "Send a voice message singing the first line of a song the group picks.",
  "Send a voice message whispering dramatically as if you're hiding from someone.",
  "Type the next message you send with your elbows only.",
  "Type everything in this chat in ALL CAPS for the next 5 minutes.",
  "Type the next 3 messages you send backwards.",
  "Do your best to type the alphabet backwards in under 30 seconds.",
  "In your next 5 messages, start every sentence with the word 'Nevertheless'.",
  "Type everything with no vowels for the next 3 minutes.",
  "Talk in rhymes for your next 5 messages.",
  "Type everything like you're an 18th century aristocrat for 5 minutes.",
  "Send a message entirely in questions.",
  "Type your next message using only punctuation and emojis — no letters.",
  "Type everything as if you're texting with one eye closed for the next 3 minutes.",
  "Write your next 3 messages in the style of a news reporter.",
  "Type everything for 5 minutes as if you're extremely confused about everything.",
  "Write a message using only words that start with the same letter.",
  "For the next 5 minutes, end every sentence with 'and that's the tea.'",
  "Write a 3-sentence horror story right now in this chat.",
  "Write a love poem about a random object near you and post it here.",
  "Write a product review for your chair right now as if it's the best chair ever made.",
  "Write a two-sentence biography of yourself in third person.",
  "Write an angry 1-star review of a made-up restaurant called 'The Soggy Napkin'.",
  "Write a haiku about whatever is directly in front of you.",
  "Write a formal complaint letter about something completely trivial.",
  "Come up with a company slogan for yourself as a product.",
  "Write a news headline about something that happened to you today.",
  "Write a heartfelt thank you note to your WiFi router.",
  "Write a one-sentence pitch for a terrible business idea.",
  "Invent a new word and use it in a sentence.",
  "Write a strongly worded letter to the concept of Mondays.",
  "Write a Twitter-style thread (3 messages) about your morning routine.",
  "Write a job listing for your current mood as if it's a position to fill.",
  "Write a dramatic monologue about running out of phone battery.",
  "Write your own obituary but make it funny.",
  "Write a 4-line rap about the server you're in right now.",
  "Write an inspirational quote but make it about something totally mundane.",
  "Write a totally honest review of your own personality in 3 sentences.",
  "Write a movie trailer narration for your morning routine.",
  "Write a strongly worded Yelp review of your own bedroom.",
  "Write a children's book summary about your last argument.",
  "Write a formal apology letter to your future self.",
  "Write a motivational speech for someone who just burned their toast.",
  "Change your nickname to something the group decides for the next 10 minutes.",
  "Change your profile picture to whatever the group decides for 30 minutes.",
  "Screenshot your most recent chat and post it here (no cheating, first one you open).",
  "Post the 5th photo in your camera roll without looking at it first.",
  "Post the last song you listened to and write one sentence defending why it's a masterpiece.",
  "Change your status to whatever the group decides for 15 minutes.",
  "Post your most recent emoji reaction and explain what you were reacting to.",
  "Post the 10th song on your most played playlist.",
  "Post your lockscreen wallpaper right now no swapping.",
  "Post the most recent meme or image saved on your phone.",
  "Post your wifi name (no password obviously).",
  "Post a totally honest review of your own personality in 3 sentences.",
  "Post your most recent notification (screenshot it).",
  "Post the first result when you Google image search your name.",
  "Post the strangest notification you've gotten today.",
  "Post a fun fact you actually know off the top of your head.",
  "Post your honest opinion of the last movie you watched in exactly 10 words.",
  "Do your best impression of a Shakespearean character for one message.",
  "Describe what you're wearing right now as if it's high fashion.",
  "Send the most dramatic possible response to 'How are you?'",
  "Describe your last dream as if it was a blockbuster movie plot.",
  "Describe the plot of a movie using only emojis.",
  "Describe the last thing you ate as if you're a food critic.",
  "Describe yourself using only the titles of movies.",
  "Write what you think everyone in the group's superpower would be.",
  "Do your best impression of a news anchor for one message.",
  "Pretend you're a customer service bot for the next 3 messages.",
  "Speak as if you're narrating a cooking show for the next 2 messages.",
  "Narrate everything you're doing right now like a sports commentator in one message.",
  "Give a TED talk summary in 3 sentences about why your favourite food is the best.",
  "Pitch a ridiculous startup idea with full confidence in one paragraph.",
  "Explain how to make a sandwich as if it's rocket science.",
  "Describe your personality as if you're a character in a video game.",
  "Give a dramatic reading of the last text message you received.",
  "Announce your entrance to the chat as if you're a professional wrestler.",
  "Roleplay as a medieval knight who has just discovered the internet.",
  "Compliment something specific about each person who's been active today.",
  "Send a message complimenting something specific about each person who's been active today.",
  "Give everyone in the server a superhero name based on their personality.",
  "Assign a spirit animal to every active person in the chat right now.",
  "Write a one-sentence roast of yourself and post it.",
  "Write a one-sentence hype message about every active person in this chat.",
  "Give the person above you an honest compliment in exactly 10 words.",
  "Ask the group a would-you-rather question that has no good answer.",
  "Tell the group something genuinely surprising about yourself.",
  "Ask the chat the most random question you can think of.",
  "Give a shoutout to someone in the server and say why they're awesome.",
  "Let the chat rename you for 10 minutes — no backsies.",
  "Ask the group to rate your vibe out of 10.",
  "Tell the chat what your role would be in a heist movie.",
  "Let the person above you assign you a dare from this list.",
  "Create a new server nickname for yourself based on your current mood.",
  "Send a message that sounds like the beginning of a spy novel.",
  "Describe your most recent purchase as if it changed your life forever.",
  "Make up a conspiracy theory about why the sky is blue and post it.",
  "Give a step-by-step guide to doing something you've never done.",
  "Invent a new holiday and explain how it's celebrated.",
  "Write the rules of a sport you just made up.",
  "Explain a basic life skill as if it's an ancient lost art.",
  "Write a fake Wikipedia intro for yourself.",
  "Create a secret handshake description using only words.",
  "Invent a new emoji and describe what it looks like and means.",
  "Write a fake fortune cookie message for every active person in chat.",
  "Come up with a band name and their worst album title.",
  "Describe your current mood as a weather forecast.",
  "Write a fake movie spoiler for a film that doesn't exist.",
];

function getRandomTD() {
  const isTruth = Math.random() < 0.5;
  return isTruth
    ? { type: 'Truth', question: truths[Math.floor(Math.random() * truths.length)], color: 0x5865F2 }
    : { type: 'Dare', question: dares[Math.floor(Math.random() * dares.length)], color: 0xff3b3b };
}

function getTypedTD(type) {
  if (type === 'truth') {
    return { type: 'Truth', question: truths[Math.floor(Math.random() * truths.length)], color: 0x5865F2 };
  } else {
    return { type: 'Dare', question: dares[Math.floor(Math.random() * dares.length)], color: 0xff3b3b };
  }
}

function makeTDEmbed(data, member) {
  return new EmbedBuilder()
    .setColor(data.color)
    .setAuthor({ name: `${data.type} — ${member.displayName}`, iconURL: member.user.displayAvatarURL() })
    .setDescription(`${data.type === 'Truth' ? '🔵' : '🔴'} ${data.question}`)
    .setFooter({ text: `${truths.length} Truths · ${dares.length} Dares in the pool — use .t / .d / .td` })
    .setTimestamp();
}

function makeTDRow(invokerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`td_reroll_${invokerId}`).setLabel('🔄 Reroll').setStyle(ButtonStyle.Secondary),
    makeDeleteBtn(invokerId)
  );
}

const LOG_CHANNEL_ID = '1484500454225477743';

// ─── HALL OF FAME (STARBOARD) ────────────────────────────────
const HALL_OF_FAME_CHANNEL_ID = '1487800915066097814'; // Replace with your actual hall-of-fame channel ID
const STAR_THRESHOLD = 3;
const starredMessages = new Set(); // track message IDs already posted

async function sendLog(guild, embed) {
  try {
    const ch = await guild.channels.fetch(LOG_CHANNEL_ID);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (e) { console.error('Log error:', e); }
}

// ─── ANTI-SPAM ───────────────────────────────────────────────
let antiSpamEnabled = true; // ON by default
const spamMap = new Map();
const OWNER_ID = '1212375999132467270';

async function handleAntiSpam(message) {
  if (!antiSpamEnabled) return;
  if (message.author.bot) return;
  if (message.member?.permissions.has('Administrator')) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!spamMap.has(userId)) spamMap.set(userId, { messages: [], muteLevel: 0, lastMuteEnd: 0 });
  const data = spamMap.get(userId);

  if (data.lastMuteEnd && now - data.lastMuteEnd > 60000) data.muteLevel = 0;

  data.messages.push({ id: message.id, time: now });
  data.messages = data.messages.filter(m => now - m.time < 5000);

  if (data.messages.length < 5) return;

  const msgIds = data.messages.map(m => m.id);
  data.messages = [];

  let muteDuration, label, deleteAll;
  switch (data.muteLevel) {
    case 0: muteDuration = 60000;    label = '1 minute';   deleteAll = false; break;
    case 1: muteDuration = 600000;   label = '10 minutes'; deleteAll = true;  break;
    case 2: muteDuration = 3600000;  label = '1 hour';     deleteAll = true;  break;
    default: muteDuration = 43200000; label = '12 hours';  deleteAll = true;  break;
  }

  const isMax = muteDuration === 43200000;
  data.muteLevel = isMax ? 0 : data.muteLevel + 1;
  data.lastMuteEnd = now + muteDuration;

  try {
    const toDelete = deleteAll ? msgIds : msgIds.slice(1);
    await message.channel.bulkDelete(toDelete, true).catch(() => {});
  } catch {}

  try { await message.member.timeout(muteDuration); } catch {}

  message.channel.send({ embeds: [new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${message.author.tag} has been muted`, iconURL: message.author.displayAvatarURL() })
    .addFields(
      { name: "<:user:1487021741720076309> User", value: `<@${userId}>`, inline: true },
      { name: "<:duration:1487022019273953300> Duration", value: label, inline: true },
      { name: "<:reason:1487022066644291614> Reason", value: 'Anti-spam — sending messages too fast.' }
    ).setTimestamp()] }).catch(() => {});

  message.author.send({ embeds: [new EmbedBuilder()
    .setColor(0xff3b3b)
    .setDescription(
`<:flash:1487027526394974218> **You have been muted for spamming**

**Server:** **${message.guild.name}**

<:duration:1487022019273953300> Duration: ${label}
<:reason:1487022066644291614> Reason: Anti-spam — sending messages too fast.`
    ).setTimestamp()] }).catch(() => {});

  sendLog(message.guild, new EmbedBuilder()
    .setColor(0xff3b3b).setTitle('🛡️ Anti-Spam Mute')
    .addFields(
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Duration', value: label, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Escalation Level', value: `${data.muteLevel}`, inline: true }
    ).setTimestamp());

  if (isMax) {
    try {
      const owner = await client.users.fetch(OWNER_ID);
      owner.send({ embeds: [new EmbedBuilder()
        .setColor(0xff3b3b)
        .setAuthor({ name: '🛡️ Anti-Spam — 12 Hour Mute Triggered', iconURL: message.guild.iconURL() })
        .setThumbnail(message.author.displayAvatarURL())
        .setDescription(`A user has been auto-muted for **12 hours** after repeated spamming.`)
        .addFields(
          { name: '<:user:1487021741720076309> User', value: `<@${userId}> (${message.author.tag})`, inline: true },
          { name: '<:reason:1487022066644291614> User ID', value: userId, inline: true },
          { name: '<:duration:1487022019273953300> Duration', value: '12 hours', inline: true },
          { name: '📁 Channel', value: `<#${message.channel.id}> in **${message.guild.name}**` },
          { name: '🔗 Jump to Channel', value: `https://discord.com/channels/${message.guild.id}/${message.channel.id}` }
        ).setTimestamp()] });
    } catch {}
  }
}

// ─── ANTI-NUKE & ANTI-RAID ───────────────────────────────────
const FULL_ACCESS_ROLE_ID = '1484500399334490282';
const IMMUNE_ROLE_ID      = '1484500399908978809'; // Owner — roles at or above this are immune
const MANAGER_ROLE_ID     = '1484500403159695471'; // Manager — can delete freely, no slow-nuke
const NUKE_OWNER_ID       = '1212375999132467270';

// ─── SLOW-NUKE TRACKER (8-hour window) ───────────────────────
// Tracks channel deletes, role deletes, kicks, bans per user over 8h
// Anyone below Manager role is subject to this
const SLOW_NUKE_WINDOW_MS = 8 * 60 * 60 * 1000; // 8 hours

// Map<userId, { channelDeletes: number[], roleDeletes: number[], kicks: number[], bans: number[], snapChannels: [], snapRoles: [], bannedUsers: [] }>
const slowNukeTracker = new Map();

function getSlowData(userId) {
  if (!slowNukeTracker.has(userId)) slowNukeTracker.set(userId, {
    channelDeletes: [], roleDeletes: [], kicks: [], bans: [],
    snapChannels: [], snapRoles: [], bannedUsers: []
  });
  return slowNukeTracker.get(userId);
}

function pruneSlowOld(arr) {
  const cutoff = Date.now() - SLOW_NUKE_WINDOW_MS;
  return arr.filter(t => t > cutoff);
}

// Returns true if the member is Manager or above (exempt from slow-nuke)
async function isManagerOrAbove(guild, userId) {
  let member = guild.members.cache.get(userId);
  if (!member) { try { member = await guild.members.fetch(userId); } catch { return false; } }
  const managerRole = guild.roles.cache.get(MANAGER_ROLE_ID);
  if (!managerRole) return false;
  return member.roles.highest.position >= managerRole.position;
}

// Strip every role granting dangerous permissions from a member
async function stripDangerousRoles(member) {
  const stripped = [];
  for (const [, role] of member.roles.cache) {
    if (role.managed) continue; // bot-integration roles can't be removed
    const p = role.permissions;
    if (p.has('ManageChannels') || p.has('ManageRoles') || p.has('KickMembers') || p.has('BanMembers') || p.has('Administrator')) {
      try { await member.roles.remove(role, 'Slow-Nuke: stripping dangerous permissions'); stripped.push(role.name); } catch {}
    }
  }
  return stripped;
}

async function executeSlowNuke(guild, executorId, actionLabel) {
  if (!antiNukeEnabled) return;
  if (await isImmune(guild, executorId)) return;
  if (await isManagerOrAbove(guild, executorId)) return;

  const executor = await guild.members.fetch(executorId).catch(() => null);
  if (!executor) return;

  const slow = getSlowData(executorId);

  // Strip dangerous roles — NO ban
  const stripped = await stripDangerousRoles(executor);

  // Revert: unban recently banned members
  for (const uid of slow.bannedUsers || []) {
    try { await guild.members.unban(uid, 'Slow-Nuke revert'); } catch {}
  }

  // Revert: recreate deleted roles (with member reassignment) + channels (with overwrite remapping)
  await revertDeletedItems(guild, slow.snapRoles || [], slow.snapChannels || []);

  const strippedText = stripped.length ? stripped.map(r => `\`${r}\``).join(', ') : 'None found';

  sendLog(guild, new EmbedBuilder()
    .setColor(0xff6600)
    .setAuthor({ name: '🛡️ Slow-Nuke Detected', iconURL: guild.iconURL() })
    .setThumbnail(executor.user.displayAvatarURL())
    .addFields(
      { name: '<:user:1487021741720076309> Perpetrator', value: `<@${executorId}> (${executor.user.tag})`, inline: true },
      { name: '<:reason:1487022066644291614> Trigger', value: actionLabel, inline: true },
      { name: '<:moderator:1487021865682735225> Response', value: 'Roles stripped + Actions reverted', inline: true },
      { name: '🔑 Roles Stripped', value: strippedText }
    ).setTimestamp());

  try {
    const owner = await client.users.fetch(NUKE_OWNER_ID);
    await owner.send({ embeds: [new EmbedBuilder()
      .setColor(0xff6600)
      .setAuthor({ name: '🚨 SLOW NUKE STOPPED', iconURL: guild.iconURL() })
      .setThumbnail(executor.user.displayAvatarURL())
      .setDescription(`A slow nuke was caught in **${guild.name}**.\nSomeone below Manager deleted more than once within 8 hours.`)
      .addFields(
        { name: '<:user:1487021741720076309> Perpetrator', value: `<@${executorId}>\n**Tag:** ${executor.user.tag}\n**ID:** ${executorId}` },
        { name: '<:flash:1487027526394974218> Trigger', value: actionLabel, inline: true },
        { name: '<:moderator:1487021865682735225> Action Taken', value: 'Roles stripped + Actions reverted', inline: true },
        { name: '🔑 Roles Stripped', value: strippedText },
        { name: '🔗 Server', value: `${guild.name} (${guild.id})` }
      ).setTimestamp()] });
  } catch {}

  slowNukeTracker.delete(executorId);
}

let antiNukeEnabled = true;
let antiRaidEnabled = true;
let raidLocked      = false;

// Track actions per user: { bans: [], kicks: [], channelDeletes: [], roleDeletes: [] }
const nukeTracker = new Map();

function getNukeData(userId) {
  if (!nukeTracker.has(userId)) nukeTracker.set(userId, {
    bans: [], kicks: [], channelDeletes: [], roleDeletes: [],
    _bannedUsers: [],
    _deletedChannels: [], // stores channel snapshot objects for revert
    _deletedRoles: []     // stores role snapshot objects for revert
  });
  return nukeTracker.get(userId);
}

function pruneOld(arr, windowMs = 10000) {
  const now = Date.now();
  return arr.filter(t => now - t < windowMs);
}

async function isImmune(guild, userId) {
  let member = guild.members.cache.get(userId);
  if (!member) { try { member = await guild.members.fetch(userId); } catch { return false; } }
  const immuneRole = guild.roles.cache.get(IMMUNE_ROLE_ID);
  if (!immuneRole) return false;
  return member.roles.highest.position >= immuneRole.position;
}

// ─── SHARED REVERT HELPER ────────────────────────────────────
// Recreates deleted roles (with member reassignment) and channels
// (with channel-level overwrites remapped to new role IDs).
async function revertDeletedItems(guild, snapRoles, snapChannels) {
  // oldId -> newId mapping so channel overwrites can reference the right role
  const roleIdMap = new Map();

  // Step 1: Recreate roles and reassign members
  for (const snap of snapRoles || []) {
    try {
      const newRole = await guild.roles.create({
        name: snap.name,
        color: snap.color,
        hoist: snap.hoist,
        mentionable: snap.mentionable,
        permissions: BigInt(snap.permissions),
        reason: 'Anti-Nuke revert'
      });

      if (snap.oldId) roleIdMap.set(snap.oldId, newRole.id);

      // Reassign to every member who previously had this role
      for (const memberId of snap.memberIds || []) {
        try {
          const m = await guild.members.fetch(memberId).catch(() => null);
          if (m) await m.roles.add(newRole, 'Anti-Nuke revert: restoring role');
        } catch {}
      }
    } catch {}
  }

  // Step 2: Recreate channels, remapping any overwrite IDs that changed
  for (const snap of snapChannels || []) {
    try {
      // Remap role IDs in permission overwrites old -> new
      const remappedOverwrites = (snap.permissionOverwrites || []).map(o => ({
        ...o,
        id: roleIdMap.get(o.id) || o.id
      }));

      await guild.channels.create({
        name: snap.name,
        type: snap.type,
        topic: snap.topic,
        nsfw: snap.nsfw,
        bitrate: snap.bitrate,
        userLimit: snap.userLimit,
        rateLimitPerUser: snap.rateLimitPerUser,
        parent: snap.parentId,
        permissionOverwrites: remappedOverwrites,
        reason: 'Anti-Nuke revert'
      });
    } catch {}
  }
}

async function executeNuke(guild, executorId, actionLabel) {
  if (!antiNukeEnabled) return;
  if (await isImmune(guild, executorId)) return;

  const executor = await guild.members.fetch(executorId).catch(() => null);
  if (!executor) return;

  const data = getNukeData(executorId);

  // DM the nuker before banning
  try { await executor.user.send('Trying to nuke?? Oh boy. You wish.'); } catch {}

  // Ban the nuker first
  try { await executor.ban({ reason: `Anti-Nuke: ${actionLabel}` }); } catch {}

  // If the nuker is a bot, also ban whoever added it
  let adderInfo = null;
  if (executor.user.bot) {
    const adderId = botAdderMap.get(executorId);
    if (adderId) {
      const adder = await guild.members.fetch(adderId).catch(() => null);
      if (adder && !(await isImmune(guild, adderId))) {
        try { await adder.ban({ reason: `Anti-Nuke: Added bot that nuked (${actionLabel})` }); } catch {}
        adderInfo = adder;
      }
      botAdderMap.delete(executorId);
    }
  }

  // Revert: unban all recently banned members
  for (const userId of data._bannedUsers || []) {
    try { await guild.members.unban(userId, 'Anti-Nuke revert'); } catch {}
  }

  // Revert: recreate deleted roles (with member reassignment) + channels (with overwrite remapping)
  await revertDeletedItems(guild, data._deletedRoles || [], data._deletedChannels || []);

  // Build response description
  const responseText = adderInfo
    ? `Bot banned + Adder (<@${adderInfo.id}>) banned + Actions Reverted`
    : 'Banned + Actions Reverted';

  // Alert log channel
  sendLog(guild, new EmbedBuilder()
    .setColor(0xff0000)
    .setAuthor({ name: '🛡️ Anti-Nuke Triggered', iconURL: guild.iconURL() })
    .setThumbnail(executor.user.displayAvatarURL())
    .addFields(
      { name: '<:user:1487021741720076309> Perpetrator', value: `<@${executorId}> (${executor.user.tag})`, inline: true },
      { name: '<:reason:1487022066644291614> Action', value: actionLabel, inline: true },
      { name: '<:moderator:1487021865682735225> Response', value: responseText, inline: true }
    ).setTimestamp());

  // DM owner
  try {
    const owner = await client.users.fetch(NUKE_OWNER_ID);
    const embedFields = [
      { name: '<:user:1487021741720076309> Perpetrator', value: `<@${executorId}>\n**Tag:** ${executor.user.tag}\n**ID:** ${executorId}` },
      { name: '<:flash:1487027526394974218> Trigger', value: actionLabel, inline: true },
      { name: '<:moderator:1487021865682735225> Action Taken', value: responseText, inline: true },
      { name: '🔗 Server', value: `${guild.name} (${guild.id})` }
    ];
    if (adderInfo) {
      embedFields.push({ name: '➕ Bot Adder (also banned)', value: `<@${adderInfo.id}>\n**Tag:** ${adderInfo.user.tag}\n**ID:** ${adderInfo.id}` });
    }
    owner.send({ embeds: [new EmbedBuilder()
      .setColor(0xff0000)
      .setAuthor({ name: '🚨 ANTI-NUKE TRIGGERED', iconURL: guild.iconURL() })
      .setThumbnail(executor.user.displayAvatarURL())
      .setDescription(`A nuke attempt was detected and neutralized in **${guild.name}**.`)
      .addFields(...embedFields)
      .setTimestamp()] });
  } catch {}

  nukeTracker.delete(executorId);
}

// Raid tracking
const raidJoinTimes = [];

async function handleRaidJoin(member) {
  if (!antiRaidEnabled) return;
  const now = Date.now();
  raidJoinTimes.push(now);
  // prune older than 10s
  const recent = raidJoinTimes.filter(t => now - t < 10000);
  raidJoinTimes.length = 0;
  raidJoinTimes.push(...recent);

  if (recent.length >= 5 && !raidLocked) {
    raidLocked = true;
    const guild = member.guild;

    // Lock all text channels
    const textChannels = guild.channels.cache.filter(c => c.type === 0);
    for (const [, ch] of textChannels) {
      try {
        await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
      } catch {}
    }

    sendLog(guild, new EmbedBuilder()
      .setColor(0xff0000)
      .setAuthor({ name: '🚨 Anti-Raid: Lockdown Active', iconURL: guild.iconURL() })
      .setDescription(`**${recent.length} members** joined in under 10 seconds.\n\nAll channels have been locked. Use \`.endraid\` to unlock.`)
      .addFields({ name: 'Status', value: '🔴 Locked Down', inline: true })
      .setTimestamp());

    try {
      const owner = await client.users.fetch(NUKE_OWNER_ID);
      owner.send({ embeds: [new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: '🚨 RAID DETECTED — SERVER LOCKED', iconURL: guild.iconURL() })
        .setDescription(`A raid was detected in **${guild.name}**.\n\n**${recent.length} joins** in under 10 seconds.\n\nAll channels are now locked. Use \`.endraid\` in the server to unlock.`)
        .setTimestamp()] });
    } catch {}
  }
}

// ─── HELP PAGES ──────────────────────────────────────────────
// 0=Overview, 1=Utility, 2=Moderation, 3=Warnings, 4=Fun
const helpPages = [
  (guild) => new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${guild.name} — Command Help`, iconURL: guild.iconURL() })
    .setDescription(
      `Welcome to the help menu! Use the buttons below to browse categories.\n\n` +
      `**Prefix:** \`.\`  •  **Total Commands:** 32\n\n` +
      `> <:user:1487021741720076309> **Utility** — Info, avatar, purge & more\n` +
      `> <:moderator:1487021865682735225> **Moderation** — Ban, kick, mute, unmute & more\n` +
      `> <:warn:1487084599296135311> **Warnings** — Warn, view, clear, warnlist & more\n` +
      `> 🎉 **Fun** — Ship, poll, truth or dare, marry & more`
    )
    .setFooter({ text: 'Page 1 of 5  •  Overview' })
    .setTimestamp(),

  (guild) => new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${guild.name} — Utility Commands`, iconURL: guild.iconURL() })
    .setDescription(`<:user:1487021741720076309> General-use commands available to everyone.\n\u200b`)
    .addFields(
      { name: '👤  `.userinfo [user]`  /  `.ui [user]`', value: '> View detailed info about a member — roles, dates, warnings & boost status.' },
      { name: '🖼️  `.avatar [user]`  /  `.av [user]`', value: '> Display a user\'s avatar in full resolution.' },
      { name: '🏠  `.serverinfo`  /  `.si`', value: '> View server info — members, channels, boost status & owner.' },
      { name: '<:user:1487021741720076309>  `.membercount`  /  `.mc`', value: '> Display the current member count of the server.' },
      { name: '🗑️  `.purge <amount>`', value: '> Bulk delete up to **100** messages. Requires **Manage Messages**.' },
      { name: '🎲  `.choose <option1> or <option2>`', value: '> Let the bot pick between two or more options for you.' },
      { name: '<:reason:1487022066644291614>  `.afk [reason]`', value: '> Set yourself as AFK. Others who ping you will be notified. Auto-removed when you chat.' },
      { name: '🏓  `.ping`', value: '> Check if the bot is online.' },
      { name: '🖼️  `.steal <n>`', value: '> Reply to a message containing a custom emoji or sticker to add it to the server. **Moderator+**' },
      { name: '📤  `.upload emoji <name>`  /  `.upload sticker <name>`', value: '> Reply to a message with an image to upload it as an emoji or sticker. **Moderator+**' }
    )
    .setFooter({ text: 'Page 2 of 5  •  Utility' })
    .setTimestamp(),

  (guild) => new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${guild.name} — Moderation Commands`, iconURL: guild.iconURL() })
    .setDescription(`<:moderator:1487021865682735225> Commands that require moderator permissions.\n\u200b`)
    .addFields(
      { name: '<:flash:1487027526394974218>  `.mute <user> [duration] [reason]`', value: '> Timeout a member. Duration accepts `s/m/h/d` (e.g. `1h`). Defaults to **24h**.' },
      { name: '<:tick:1487030751550509066>  `.unmute <user>`', value: '> Remove a timeout from a member.' },
      { name: '🔨  `.ban <user> [reason]`', value: '> Permanently ban a member from the server.' },
      { name: '✅  `.unban <userID> [reason]`', value: '> Unban a previously banned user by their ID.' },
      { name: '👟  `.kick <user> [reason]`', value: '> Kick a member from the server.' },
      { name: '🔒  `.lock`', value: '> Prevent everyone from sending messages in the current channel.' },
      { name: '🔓  `.unlock`', value: '> Restore message permissions in the current channel.' },
      { name: '✏️  `.nick <user> <nickname>`', value: '> Change a member\'s nickname.' },
      { name: '🎭  `.role <user> <role>`', value: '> Assign or remove a role from a member. Toggles automatically.' },
      { name: '🛡️  `.as`', value: '> Toggle the anti-spam system on/off. **On by default.** Requires **Administrator**.' },
      { name: '🔨  `.banlist`', value: '> View all currently banned users in the server. Requires **Ban Members**.' }
    )
    .setFooter({ text: 'Page 3 of 5  •  Moderation' })
    .setTimestamp(),

  (guild) => new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${guild.name} — Warning Commands`, iconURL: guild.iconURL() })
    .setDescription(`<:warn:1487084599296135311> Track and manage member warnings.\n\u200b`)
    .addFields(
      { name: '<:warn:1487084599296135311>  `.warn <user> [reason]`', value: '> Issue a warning to a member. Warnings are tracked per server.' },
      { name: '↩️  `.removewarn <user>`', value: '> Remove the most recent warning from a member.' },
      { name: '🗑️  `.clearwarns <user>`', value: '> Clear **all** warnings for a member.' },
      { name: '📋  `.warns [user]`', value: '> View warnings for a member. Leave blank to check your own.' },
      { name: '📋  `.warnlist`', value: '> Show all members with active warnings, sorted by count.' },
      {
        name: '\u200b',
        value: '**⚡ Auto-Punishment Thresholds**\n> `3 warnings` → Auto-muted for **6 hours**\n> `5 warnings` → Auto-kicked from the server'
      }
    )
    .setFooter({ text: 'Page 4 of 5  •  Warnings' })
    .setTimestamp(),

  (guild) => new EmbedBuilder()
    .setColor(0xff6b9d)
    .setAuthor({ name: `${guild.name} — Fun Commands`, iconURL: guild.iconURL() })
    .setDescription(`🎉 Fun commands for everyone.\n\u200b`)
    .addFields(
      { name: '💘  `.ship <user1> <user2>`', value: '> Calculate the ship compatibility between two members.' },
      { name: '📊  `.poll <question>`', value: '> Post a poll with ✅ / ❌ reactions. Anyone can vote.' },
      { name: '🎭  `.td`  /  `.t`  /  `.d`', value: '> Get a random **Truth or Dare**. Use `.t` for truth only, `.d` for dare only.' },
      { name: '🌈  `.gay <user>`  /  `.howgay <user>`', value: '> Check how gay someone is. Results may vary.' },
      { name: '💍  `.marry <user>`', value: '> Propose to another member! They\'ll get an Accept / Decline button. Also works by replying to their message with `.marry`.' },
      { name: '💔  `.divorce`', value: '> End your current marriage. Sad but valid.' }
    )
    .setFooter({ text: 'Page 5 of 5  •  Fun' })
    .setTimestamp(),
];

function makeHelpRow(page, invokerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help_prev_${page}_${invokerId}`)
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`help_overview_${page}_${invokerId}`)
      .setLabel('Overview')
      .setStyle(page === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`help_next_${page}_${invokerId}`)
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === helpPages.length - 1),
    makeDeleteBtn(invokerId)
  );
}

// ─────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    status: 'online',
    activities: [{ name: '.gg/wQvb6aqZWZ', type: 4 }]
  });
});

// ─── PREFIX COMMANDS ─────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ─── COUNT MESSAGES ───────────────────────────────────────
  if (message.guild) {
    // All-time
    const msgData = loadMsgData();
    const gKey = message.guild.id;
    if (!msgData[gKey]) msgData[gKey] = {};
    msgData[gKey][message.author.id] = (msgData[gKey][message.author.id] || 0) + 1;
    saveMsgData(msgData);

    // Daily — reset if new day (IST)
    const daily = loadDailyData();
    const todayIST = getTodayIST();
    if (daily.date !== todayIST) { daily.date = todayIST; daily.counts = {}; }
    if (!daily.counts[gKey]) daily.counts[gKey] = {};
    daily.counts[gKey][message.author.id] = (daily.counts[gKey][message.author.id] || 0) + 1;
    saveDailyData(daily);
  }

  handleAntiSpam(message);

  // AFK: remove AFK if person types
  if (afkMap.has(message.author.id) && !message.content.startsWith(prefix)) {
    const data = afkMap.get(message.author.id);
    const pings = data.pings || 0;
    afkMap.delete(message.author.id);
    message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`<:tick:1487030751550509066> Welcome back <@${message.author.id}>! Your AFK has been removed.${pings > 0 ? `\n<:book_move:1484604157221540020> You got **${pings}** ping${pings === 1 ? '' : 's'} while you were away.` : ''}`)
      .setTimestamp()] }).catch(() => {});
  }

  // AFK: notify if someone pings an AFK user
  if (message.mentions.users.size > 0) {
    for (const [userId, data] of afkMap) {
      if (message.mentions.users.has(userId)) {
        const afkMember = message.guild?.members.cache.get(userId);
        const name = afkMember?.displayName || 'That user';
        data.pings = (data.pings || 0) + 1;
        message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0x2b2d31)
          .setDescription(`<:reason:1487022066644291614> **${name}** is AFK right now: ${data.reason}`)
          .setTimestamp()] }).catch(() => {});
      }
    }
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).split(' ');
  const command = args[0].toLowerCase();
  const invokerId = message.author.id;

  // ─── COOLDOWN (non-mod commands only) ────────────────────
  const MOD_COMMANDS = new Set([
    'mute','unmute','ban','unban','kick','warn','clearwarns','removewarn',
    'banlist','warnlist','lock','unlock','nick','role','purge','as',
    'antinuke','antiraid','endraid'
  ]);
  if (!MOD_COMMANDS.has(command)) {
    const cooldownKey = `${message.author.id}_${command}`;
    const now = Date.now();
    if (cooldowns.has(cooldownKey)) {
      const remaining = ((cooldowns.get(cooldownKey) + 5000) - now) / 1000;
      if (remaining > 0) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setDescription(`<:flash:1487027526394974218> Slow down! You can use this command again in **${remaining.toFixed(1)}s**.`)
          .setTimestamp()], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
      }
    }
    cooldowns.set(cooldownKey, now);
    setTimeout(() => cooldowns.delete(cooldownKey), 5000);
  }

  // ─── PING ────────────────────────────────────────────────
  if (command === 'ping') {
    return message.reply('Pong 🏓');
  }

  // ─── HELP ────────────────────────────────────────────────
  if (command === 'help') {
    const sub = args[1]?.toLowerCase();

    if (sub === 'raid' || sub === 'nuke') {
      if (!message.member.permissions.has('Administrator')) return;
      const isRaid = sub === 'raid';
      const embed = isRaid
        ? new EmbedBuilder()
            .setColor(0xff0000)
            .setAuthor({ name: `${message.guild.name} — Anti-Raid`, iconURL: message.guild.iconURL() })
            .setDescription('🚨 Anti-Raid system protects the server from mass join attacks.\n\u200b')
            .addFields(
              { name: '⚙️ Trigger', value: '**5 joins within 10 seconds** activates lockdown.' },
              { name: '🔒 Response', value: 'All text channels are locked for **@everyone** automatically.' },
              { name: '🔓  `.endraid`', value: '> Manually end the lockdown and restore all channels. **Admin only.**' },
              { name: '🚨  `.antiraid`', value: '> Toggle Anti-Raid on/off. **Full Access only.** On by default.' },
              { name: '📊 Current Status', value: `Anti-Raid: **${antiRaidEnabled ? '🟢 Enabled' : '🔴 Disabled'}**\nLockdown: **${raidLocked ? '🔴 Active' : '🟢 None'}**` }
            )
            .setTimestamp()
        : new EmbedBuilder()
            .setColor(0xff0000)
            .setAuthor({ name: `${message.guild.name} — Anti-Nuke`, iconURL: message.guild.iconURL() })
            .setDescription('🛡️ Anti-Nuke protects the server from internal threats.\n\u200b')
            .addFields(
              { name: '⚙️ Triggers', value: '**3 bans** in 10s\n**3 kicks** in 10s\n**2 channel deletes** in 10s\n**2 role deletes** in 10s' },
              { name: '🔨 Response', value: 'Perpetrator is **banned immediately**, then actions are **reverted**. You are **DM\'d** with full details.' },
              { name: '🛡️ Immune Roles', value: `Roles at or above <@&${IMMUNE_ROLE_ID}> are immune.` },
              { name: '🛡️  `.antinuke`', value: '> Toggle Anti-Nuke on/off. **Full Access only.** On by default.' },
              { name: '📊 Current Status', value: `Anti-Nuke: **${antiNukeEnabled ? '🟢 Enabled' : '🔴 Disabled'}**` }
            )
            .setTimestamp();
      return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    }

    let page = 0;
    if (sub === 'util' || sub === 'utility')                             page = 1;
    else if (sub === 'mod' || sub === 'moderation')                      page = 2;
    else if (sub === 'warn' || sub === 'warnings' || sub === 'warning')  page = 3;
    else if (sub === 'fun')                                              page = 4;

    const embed = helpPages[page](message.guild);
    const row = makeHelpRow(page, invokerId);
    return message.channel.send({ embeds: [embed], components: [row] });
  }

  // ─── MUTE ────────────────────────────────────────────────
  if (command === 'mute') {
    try {
      if (!message.member.permissions.has('ModerateMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('mute')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.channel.send({
          embeds: [hierarchyEmbed('mute')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      let timeArg = args[2];
      let reason, ms;

      if (timeArg && /^[0-9]+[smhd]$/.test(timeArg)) {
        ms = parseTime(timeArg);
        reason = args.slice(3).join(" ") || "No reason provided";
      } else {
        ms = 24 * 60 * 60 * 1000;
        reason = args.slice(2).join(" ") || "No reason provided";
        timeArg = "24h";
      }

      await member.timeout(ms);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been muted`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:duration:1487022019273953300> Duration", value: timeArg, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`unmute_btn_${member.id}_${invokerId}`).setLabel('Unmute').setStyle(ButtonStyle.Success),
        makeDeleteBtn(invokerId)
      );

      message.channel.send({ embeds: [embed], components: [row] });

      member.user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription(
`<:flash:1487027526394974218> **You have been muted**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:duration:1487022019273953300> Duration: ${timeArg}  
<:reason:1487022066644291614> Reason: ${reason}`
      ).setTimestamp()] }).catch(() => {});

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0xff3b3b).setTitle('🔇 Member Muted')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Duration', value: timeArg, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error muting user."); }
  }

  // ─── CHOOSE ──────────────────────────────────────────────
  if (command === 'choose') {
    try {
      const input = args.slice(1).join(' ');
      if (!input.includes(' or ')) return message.reply("Format: `.choose option1 or option2`");

      const options = input.split(' or ').map(o => o.trim()).filter(o => o.length > 0);
      if (options.length < 2) return message.reply("Provide at least 2 options separated by `or`.");

      const chosen = options[Math.floor(Math.random() * options.length)];

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: 'I choose...', iconURL: message.guild.iconURL() })
        .setDescription(`🎲 **${chosen}**`)
        .setFooter({ text: `Requested by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error choosing."); }
  }

  // ─── USERINFO ────────────────────────────────────────────
  if (command === 'userinfo' || command === 'ui') {
    try {
      let target;
      if (args[1]) {
        const idMatch = args[1].match(/^<?@?!?(\d{17,19})>?$/);
        if (idMatch) {
          try { target = await message.guild.members.fetch(idMatch[1]); }
          catch { return message.reply("Invalid user ID or user not in server."); }
        } else {
          return message.reply("Mention a user or provide a valid user ID.");
        }
      } else {
        target = message.member;
      }

      const user = target.user;
      const joinedAt = Math.floor(target.joinedTimestamp / 1000);
      const createdAt = Math.floor(user.createdTimestamp / 1000);
      const roles = target.roles.cache.filter(r => r.id !== message.guild.id).sort((a, b) => b.position - a.position);
      const topRole = roles.first();
      const warns = loadWarns();
      const warnCount = (warns[`${message.guild.id}_${user.id}`] || []).length;
      const isBoosting = !!target.premiumSince;

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `User Info: ${user.username}`, iconURL: user.displayAvatarURL() })
        .setDescription(`Details about <@${user.id}>`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "📋 Basic Info", value: `**ID:** ${user.id}\n**Username:** ${user.username}\n**Display Name:** ${target.displayName}\n**Bot:** ${user.bot ? 'True' : 'False'}` },
          { name: "📅 Timestamps", value: `**Joined:** <t:${joinedAt}:R> • <t:${joinedAt}:f>\n**Created:** <t:${createdAt}:R> • <t:${createdAt}:f>` },
          { name: "⚡ Boosting", value: isBoosting ? 'Yes' : 'No', inline: true },
          { name: "<:warn:1487084599296135311> Warnings", value: `${warnCount}`, inline: true },
          { name: `🎭 Roles [${roles.size}]`, value: roles.size > 0 ? roles.map(r => `<@&${r.id}>`).join(', ') : 'None' },
          { name: "🏆 Top Role", value: topRole ? `<@&${topRole.id}>` : 'None' }
        )
        .setFooter({ text: `Requested by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error fetching user info."); }
  }

  // ─── LOCK ────────────────────────────────────────────────
  if (command === 'lock') {
    try {
      if (!message.member.permissions.has('ManageChannels')) {
        return message.channel.send({
          embeds: [noPermsEmbed('lock channels for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });

      const embed = new EmbedBuilder()
        .setColor(0xff3b3b)
        .setAuthor({ name: `#${message.channel.name} has been locked`, iconURL: message.guild.iconURL() })
        .addFields(
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:reason:1487022066644291614> Channel", value: `<#${message.channel.id}>`, inline: true }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0xff3b3b).setTitle('🔒 Channel Locked')
        .addFields(
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error locking channel."); }
  }

  // ─── UNLOCK ──────────────────────────────────────────────
  if (command === 'unlock') {
    try {
      if (!message.member.permissions.has('ManageChannels')) {
        return message.channel.send({
          embeds: [noPermsEmbed('unlock channels for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: `#${message.channel.name} has been unlocked`, iconURL: message.guild.iconURL() })
        .addFields(
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:reason:1487022066644291614> Channel", value: `<#${message.channel.id}>`, inline: true }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0x57F287).setTitle('🔓 Channel Unlocked')
        .addFields(
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error unlocking channel."); }
  }

  // ─── MEMBERCOUNT ─────────────────────────────────────────
  if (command === 'membercount' || command === 'mc') {
    try {
      const guild = message.guild;
      await guild.fetch();

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .addFields({ name: "<:user:1487021741720076309> Total Members", value: `${guild.memberCount}`, inline: true })
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error fetching member count."); }
  }

  // ─── SERVERINFO ──────────────────────────────────────────
  if (command === 'serverinfo' || command === 'si') {
    try {
      const guild = message.guild;
      await guild.fetch();

      const owner = await guild.fetchOwner();
      const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
      const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
      const categories = guild.channels.cache.filter(c => c.type === 4).size;
      const createdAt = Math.floor(guild.createdTimestamp / 1000);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: "📋 General Info", value: `**Name:** ${guild.name}\n**Server ID:** ${guild.id}\n**Owner:** <@${owner.id}>\n**Created:** <t:${createdAt}:R> • <t:${createdAt}:f>` },
          { name: "👥 Members & Roles", value: `**Members:** ${guild.memberCount}\n**Roles:** ${guild.roles.cache.size}\n**Verification Level:** ${guild.verificationLevel.toString().toLowerCase()}`, inline: true },
          { name: "💎 Boost Status", value: `**Level:** ${guild.premiumTier}\n**Boosts:** ${guild.premiumSubscriptionCount}`, inline: true },
          { name: "📁 Channels", value: `**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Categories:** ${categories}` }
        )
        .setFooter({ text: `Requested by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error fetching server info."); }
  }

  // ─── AVATAR ──────────────────────────────────────────────
  if (command === 'avatar' || command === 'av') {
    try {
      let target;
      if (args[1]) {
        const idMatch = args[1].match(/^<?@?!?(\d{17,19})>?$/);
        if (idMatch) {
          try { target = await client.users.fetch(idMatch[1]); }
          catch { return message.reply("Invalid user ID."); }
        } else {
          return message.reply("Mention a user or provide a valid user ID.");
        }
      } else {
        target = message.author;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${target.username}'s avatar`, iconURL: target.displayAvatarURL({ size: 4096 }) })
        .setImage(target.displayAvatarURL({ size: 4096, extension: 'png' }))
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error fetching avatar."); }
  }

  // ─── PURGE ───────────────────────────────────────────────
  if (command === 'purge') {
    try {
      if (!message.member.permissions.has('ManageMessages')) {
        return message.channel.send({
          embeds: [noPermsEmbed('purge messages for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount < 1 || amount > 100)
        return message.reply("Provide a number between 1 and 100.");

      await message.delete();
      const deleted = await message.channel.bulkDelete(amount, true);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${deleted.size} messages purged`, iconURL: message.guild.iconURL() })
        .addFields(
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:reason:1487022066644291614> Amount", value: `${deleted.size}`, inline: true }
        )
        .setTimestamp();

      const msg = await message.channel.send({ embeds: [embed] });
      setTimeout(() => msg.delete().catch(() => {}), 5000);

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0xff3b3b).setTitle('🗑️ Messages Purged')
        .addFields(
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Amount', value: `${deleted.size}`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error purging messages. Messages older than 14 days can't be bulk deleted."); }
  }

  // ─── UNBAN ───────────────────────────────────────────────
  if (command === 'unban') {
    try {
      if (!message.member.permissions.has('BanMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('unban')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const userId = args[1];
      if (!userId) return message.reply("Provide user ID.");

      const reason = args.slice(2).join(" ") || "No reason provided";

      let user;
      try { user = await client.users.fetch(userId); }
      catch { return message.reply("Invalid user ID."); }

      await message.guild.members.unban(userId, reason);

      let invite;
      try {
        const channel = message.guild.channels.cache.find(c => c.type === 0);
        invite = await channel.createInvite({ maxAge: 0, maxUses: 1 });
      } catch { invite = null; }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${user.tag} has been unbanned`, iconURL: user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>` }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ban_btn_${user.id}_${invokerId}`).setLabel('Ban').setStyle(ButtonStyle.Danger),
        makeDeleteBtn(invokerId)
      );

      message.channel.send({ embeds: [embed], components: [row] });

      user.send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(
`<:tick:1487030751550509066> **You have been unbanned**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:reason:1487022066644291614> Reason: ${reason}

${invite ? `<:Links:1487353216235737240> **Rejoin:** ${invite.url}` : ""}`
      ).setTimestamp()] }).catch(() => {});

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0x57F287).setTitle('✅ Member Unbanned')
        .addFields(
          { name: 'User', value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error unbanning user."); }
  }

  // ─── UNMUTE ──────────────────────────────────────────────
  if (command === 'unmute') {
    try {
      if (!message.member.permissions.has('ModerateMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('unmute')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.channel.send({
          embeds: [hierarchyEmbed('unmute')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      await member.timeout(null);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been unmuted`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mute_btn_${member.id}_${invokerId}`).setLabel('Mute').setStyle(ButtonStyle.Danger),
        makeDeleteBtn(invokerId)
      );

      message.channel.send({ embeds: [embed], components: [row] });

      member.user.send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(
`<:tick:1487030751550509066> **You have been unmuted**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>`
      ).setTimestamp()] }).catch(() => {});

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0x57F287).setTitle('🔊 Member Unmuted')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error unmuting user."); }
  }

  // ─── NICK ────────────────────────────────────────────────
  if (command === 'nick') {
    try {
      if (!message.member.permissions.has('ManageNicknames')) {
        return message.channel.send({
          embeds: [noPermsEmbed('nick')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.channel.send({
          embeds: [hierarchyEmbed('nick')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const newNick = args.slice(2).join(" ");
      if (!newNick) return message.reply("Provide a nickname.");

      await member.setNickname(newNick);

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0x5865F2).setTitle('✏️ Nickname Changed')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'New Nickname', value: newNick }
        ).setTimestamp());

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: "Nickname Updated", iconURL: `https://cdn.discordapp.com/emojis/1487030751550509066.png` })
        .setDescription(`<:tick:1487030751550509066> Successfully changed nickname of <@${member.id}> to **${newNick}**.`)
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Requested by", value: `<@${invokerId}>`, inline: true }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error changing nickname. Make sure I have permission."); }
  }

  // ─── BAN ─────────────────────────────────────────────────
  if (command === 'ban') {
    try {
      if (!message.member.permissions.has('BanMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('ban')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.channel.send({
          embeds: [hierarchyEmbed('ban')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const reason = args.slice(2).join(" ") || "No reason provided";

      await member.ban({ reason });

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been banned`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>` }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`unban_btn_${member.id}_${invokerId}`).setLabel('Unban').setStyle(ButtonStyle.Success),
        makeDeleteBtn(invokerId)
      );

      message.channel.send({ embeds: [embed], components: [row] });

      member.user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription(
`<:flash:1487027526394974218> **You have been banned**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:reason:1487022066644291614> Reason: ${reason}`
      ).setTimestamp()] }).catch(() => {});

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0xff3b3b).setTitle('🔨 Member Banned')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error banning user."); }
  }

  // ─── KICK ────────────────────────────────────────────────
  if (command === 'kick') {
    try {
      if (!message.member.permissions.has('KickMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('kick')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.channel.send({
          embeds: [hierarchyEmbed('kick')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const reason = args.slice(2).join(" ") || "No reason provided";

      let invite;
      try {
        const channel = message.guild.channels.cache.find(c => c.type === 0);
        invite = await channel.createInvite({ maxAge: 0, maxUses: 1 });
      } catch { invite = null; }

      await member.kick();

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been kicked`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>` }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

      member.user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription(
`<:flash:1487027526394974218> **You have been kicked**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:reason:1487022066644291614> Reason: ${reason}

${invite ? `<:Links:1487353216235737240> **Rejoin:** ${invite.url}` : ""}`
      ).setTimestamp()] }).catch(() => {});

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0xFFA500).setTitle('👟 Member Kicked')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error kicking user."); }
  }

  // ─── WARN ────────────────────────────────────────────────
  if (command === 'warn') {
    try {
      if (!message.member.permissions.has('ModerateMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('warn')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.channel.send({
          embeds: [hierarchyEmbed('warn')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const reason = args.slice(2).join(" ") || "No reason provided";

      const warns = loadWarns();
      const key = `${message.guild.id}_${member.id}`;
      if (!warns[key]) warns[key] = [];
      warns[key].push({ reason, by: invokerId, at: Date.now() });
      saveWarns(warns);

      const count = warns[key].length;

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been warned`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:warn:1487084599296135311> Warnings", value: `${count}`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason }
        ).setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

      member.user.send({ embeds: [new EmbedBuilder().setColor(0xFFA500).setDescription(
`<:warn:1487084599296135311> **You have been warned**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>
<:reason:1487022066644291614> Reason: ${reason}
<:warn:1487084599296135311> Total Warnings: **${count}**`
      ).setTimestamp()] }).catch(() => {});

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0xFFA500).setTitle('<:warn:1487084599296135311> Member Warned')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Warnings', value: `${count}`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());

      if (count === 3) {
        await member.timeout(6 * 60 * 60 * 1000);
        member.user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b)
          .setDescription(`<:muteee:1487085617119756358> **You have been auto-muted for 6 hours** in **${message.guild.name}** for reaching 3 warnings.`).setTimestamp()] }).catch(() => {});
        sendLog(message.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('<:muteee:1487085617119756358> Auto-Muted (3 Warnings)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Duration', value: '6 hours', inline: true }
          ).setTimestamp());
      }

      if (count === 5) {
        await member.kick("5 warnings reached");
        member.user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b)
          .setDescription(`<:flashwarn:1487025332841091182> **You have been auto-kicked** from **${message.guild.name}** for reaching 5 warnings.`).setTimestamp()] }).catch(() => {});
        sendLog(message.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('<:flashwarn:1487025332841091182> Auto-Kicked (5 Warnings)')
          .addFields({ name: 'User', value: `<@${member.id}>`, inline: true }).setTimestamp());
      }
    } catch (err) { console.error(err); message.reply("Error warning user."); }
  }

  // ─── CLEARWARNS ──────────────────────────────────────────
  if (command === 'clearwarns') {
    try {
      if (!message.member.permissions.has('ModerateMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('clear warns for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      const warns = loadWarns();
      const key = `${message.guild.id}_${member.id}`;
      const prev = warns[key]?.length || 0;
      warns[key] = [];
      saveWarns(warns);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag}'s warnings cleared`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:warn:1487084599296135311> Warnings Cleared", value: `${prev}`, inline: true }
        ).setTimestamp();

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0x57F287).setTitle('🗑️ Warnings Cleared')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Cleared', value: `${prev} warnings`, inline: true }
        ).setTimestamp());

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error clearing warnings."); }
  }

  // ─── REMOVEWARN ──────────────────────────────────────────
  if (command === 'removewarn') {
    try {
      if (!message.member.permissions.has('ModerateMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('remove a warn for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      const warns = loadWarns();
      const key = `${message.guild.id}_${member.id}`;
      if (!warns[key] || warns[key].length === 0) return message.reply("This user has no warnings.");

      warns[key].pop();
      saveWarns(warns);
      const remaining = warns[key].length;

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `Warning removed from ${member.user.tag}`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:warn:1487084599296135311> Remaining", value: `${remaining}`, inline: true }
        ).setTimestamp();

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0x57F287).setTitle('↩️ Warning Removed')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Remaining', value: `${remaining}`, inline: true }
        ).setTimestamp());

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error removing warning."); }
  }

  // ─── WARNS ───────────────────────────────────────────────
  if (command === 'warns') {
    try {
      const member = args[1]
        ? (await resolveMember(message.guild, args[1])) || await message.guild.members.fetch(message.author.id)
        : await message.guild.members.fetch(message.author.id);

      const warns = loadWarns();
      const key = `${message.guild.id}_${member.id}`;
      const list = warns[key] || [];

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag}'s warnings`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:warn:1487084599296135311> Total Warnings", value: `${list.length}`, inline: true },
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true }
        );

      if (list.length > 0) {
        embed.addFields({
          name: "History",
          value: list.slice(-5).map((w, i) => `**${i + 1}.** ${w.reason} — <@${w.by}>`).join('\n')
        });
      }

      embed.setTimestamp();
      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error fetching warnings."); }
  }

  // ─── ROLE ────────────────────────────────────────────────
  if (command === 'role') {
    try {
      if (!message.member.permissions.has('ManageRoles')) {
        return message.channel.send({
          embeds: [noPermsEmbed('assign a role to')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const member = await resolveMember(message.guild, args[1]);
      if (!member) return message.reply("Mention a user or provide a valid user ID.");

      if (message.member.roles.highest.position <= member.roles.highest.position) {
        return message.channel.send({
          embeds: [hierarchyEmbed('assign a role to')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const roleArg = args[2];
      if (!roleArg) return message.reply("Provide a role mention or role ID.");
      const roleIdMatch = roleArg.match(/^<?@?&?(\d{17,19})>?$/);
      if (!roleIdMatch) return message.reply("Invalid role. Mention a role or provide a valid role ID.");
      const role = message.guild.roles.cache.get(roleIdMatch[1]) || await message.guild.roles.fetch(roleIdMatch[1]).catch(() => null);
      if (!role) return message.reply("Role not found.");

      const botMember = await message.guild.members.fetchMe();
      if (botMember.roles.highest.position <= role.position) {
        return message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff3b3b)
            .setAuthor({ name: 'Missing Permissions' })
            .setDescription(`<:flash:1487027526394974218> **I cannot assign the role ${role.name}.**\n\nThat role is equal to or higher than my highest role.`)
            .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const hasRole = member.roles.cache.has(role.id);
      if (hasRole) { await member.roles.remove(role); }
      else { await member.roles.add(role); }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been ${hasRole ? 'removed from' : 'assigned'} a role`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:reason:1487022066644291614> Role", value: `<@&${role.id}>`, inline: true }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

      member.user.send({ embeds: [new EmbedBuilder()
        .setColor(hasRole ? 0xff3b3b : 0x57F287)
        .setDescription(
`${hasRole ? '<:flash:1487027526394974218>' : '<:tick:1487030751550509066>'} **Your role has been ${hasRole ? 'removed' : 'assigned'}**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>
<:reason:1487022066644291614> Role: ${role.name}`
        ).setTimestamp()] }).catch(() => {});

      sendLog(message.guild, new EmbedBuilder()
        .setColor(0x5865F2).setTitle(`🎭 Role ${hasRole ? 'Removed' : 'Assigned'}`)
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Role', value: role.name, inline: true }
        ).setTimestamp());
    } catch (err) { console.error(err); message.reply("Error assigning role."); }
  }

  // ─── ANTI-SPAM TOGGLE ────────────────────────────────────
  if (command === 'as') {
    if (!message.member.permissions.has('Administrator')) {
      return message.channel.send({
        embeds: [noPermsEmbed('toggle anti-spam for')],
        components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
      });
    }

    antiSpamEnabled = !antiSpamEnabled;

    const embed = new EmbedBuilder()
      .setColor(antiSpamEnabled ? 0x57F287 : 0xff3b3b)
      .setAuthor({ name: `Anti-Spam ${antiSpamEnabled ? 'Enabled' : 'Disabled'}`, iconURL: message.guild.iconURL() })
      .setDescription(`<:moderator:1487021865682735225> **${message.member.displayName}** has turned anti-spam **${antiSpamEnabled ? 'on' : 'off'}**.`)
      .setTimestamp();

    message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

    sendLog(message.guild, new EmbedBuilder()
      .setColor(antiSpamEnabled ? 0x57F287 : 0xff3b3b)
      .setTitle(`🛡️ Anti-Spam ${antiSpamEnabled ? 'Enabled' : 'Disabled'}`)
      .addFields({ name: 'Moderator', value: `<@${invokerId}>`, inline: true })
      .setTimestamp());
  }

  // ─── TRUTH & DARE ────────────────────────────────────────
  if (command === 'td' || command === 't' || command === 'd') {
    const data = command === 't' ? getTypedTD('truth') : command === 'd' ? getTypedTD('dare') : getRandomTD();
    const embed = makeTDEmbed(data, message.member);
    const row = makeTDRow(invokerId);
    message.channel.send({ embeds: [embed], components: [row] });
  }

  // ─── AFK ─────────────────────────────────────────────────
  if (command === 'afk') {
    const reason = args.slice(1).join(" ") || "I am AFK (Away from Keyboard) right now, talk to you later!";
    afkMap.set(message.author.id, { reason, since: Date.now() });

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: `${message.member.displayName} is now AFK`, iconURL: message.author.displayAvatarURL() })
      .setDescription(`**Reason:** ${reason}`)
      .setTimestamp();

    message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
  }

  // ─── SHIP ────────────────────────────────────────────────
  if (command === 'ship') {
    try {
      const user1 = message.mentions.users.first();
      const user2 = message.mentions.users.last();
      if (!user1 || user1.id === user2?.id || !user2) return message.reply('Mention two different users. Usage: `.ship @user1 @user2`');

      const pct = Math.floor(Math.random() * 101);
      const filled = Math.round(pct / 10);
      const bar = '💗'.repeat(filled) + '🖤'.repeat(10 - filled);

      let verdict;
      if (pct >= 90)      verdict = '💞 Soulmates. Undeniable.';
      else if (pct >= 75) verdict = '💕 Strong connection!';
      else if (pct >= 55) verdict = '💛 There\'s something there...';
      else if (pct >= 35) verdict = '🤝 Friends, maybe more?';
      else if (pct >= 15) verdict = '😬 Awkward at best.';
      else                verdict = '💀 Absolutely not.';

      const shipName = user1.username.slice(0, Math.ceil(user1.username.length / 2)) +
                       user2.username.slice(Math.floor(user2.username.length / 2));

      const embed = new EmbedBuilder()
        .setColor(0xff6b9d)
        .setAuthor({ name: '💘 Ship Calculator', iconURL: message.guild.iconURL() })
        .setDescription(`**${user1.username}** & **${user2.username}**\n\n${bar}\n\n**${pct}% compatibility**\n${verdict}`)
        .addFields(
          { name: '👫 Ship Name', value: `**${shipName}**`, inline: true },
          { name: '❤️ Score',     value: `**${pct}/100**`,  inline: true }
        )
        .setFooter({ text: `Requested by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply('Error running ship command.'); }
  }

  // ─── POLL ────────────────────────────────────────────────
  if (command === 'poll') {
    try {
      const question = args.slice(1).join(' ');
      if (!question) return message.reply('Provide a question. Usage: `.poll <question>`');

      await message.delete().catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: '📊 Poll', iconURL: message.guild.iconURL() })
        .setDescription(`**${question}**`)
        .addFields(
          { name: '<:tick:1487030751550509066> Yes', value: '​', inline: true },
          { name: '<:flash:1487027526394974218> No', value: '​', inline: true }
        )
        .setFooter({ text: `Poll by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      const pollMsg = await message.channel.send({ embeds: [embed] });
      await pollMsg.react('<:tick:1487030751550509066>');
      await pollMsg.react('<:flash:1487027526394974218>');
    } catch (err) { console.error(err); message.reply('Error creating poll.'); }
  }

  // ─── MARRY ───────────────────────────────────────────────
  if (command === 'marry') {
    try {
      // Resolve target: mention in args OR replied-to message's author
      let target;
      if (args[1]) {
        target = await resolveMember(message.guild, args[1]);
      } else if (message.reference) {
        const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (replied) target = await message.guild.members.fetch(replied.author.id).catch(() => null);
      }

      if (!target) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Missing Target' })
          .setDescription('<:flash:1487027526394974218> **Mention someone or reply to their message to propose!**\n\nUsage: `.marry @user` or reply to their message with `.marry`')
          .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      if (target.id === message.author.id) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Nice Try 💀' })
          .setDescription('<:flash:1487027526394974218> **You can\'t marry yourself.**')
          .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      if (target.user.bot) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Nice Try 💀' })
          .setDescription('<:flash:1487027526394974218> **You can\'t marry a bot.**')
          .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const marriages = loadMarriages();
      const guildKey = message.guild.id;
      if (!marriages[guildKey]) marriages[guildKey] = {};

      if (marriages[guildKey][message.author.id]) {
        const spouseId = marriages[guildKey][message.author.id];
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Already Married 💍' })
          .setDescription(`<:flash:1487027526394974218> **You are already married to <@${spouseId}>!**\n\nUse \`.divorce\` first if you want to remarry.`)
          .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      if (marriages[guildKey][target.id]) {
        const spouseId = marriages[guildKey][target.id];
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Already Taken 💔' })
          .setDescription(`<:flash:1487027526394974218> **<@${target.id}> is already married to <@${spouseId}>!**`)
          .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const proposalEmbed = new EmbedBuilder()
        .setColor(0xff6b9d)
        .setAuthor({ name: '💍 Marriage Proposal!', iconURL: message.author.displayAvatarURL() })
        .setDescription(
          `<@${message.author.id}> has proposed to <@${target.id}>! 💍\n\n` +
          `**<@${target.id}>, do you accept?**\n\n` +
          `_This proposal expires in 60 seconds._`
        )
        .setThumbnail(target.user.displayAvatarURL())
        .setTimestamp();

      const proposalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`marry_accept_${message.author.id}_${target.id}`)
          .setLabel('💍 Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`marry_decline_${message.author.id}_${target.id}`)
          .setLabel('💔 Decline')
          .setStyle(ButtonStyle.Danger)
      );

      const proposalMsg = await message.channel.send({ embeds: [proposalEmbed], components: [proposalRow] });

      // Auto-expire after 60 seconds
      setTimeout(async () => {
        const current = await proposalMsg.fetch().catch(() => null);
        if (!current || !current.components?.length) return;
        const expiredEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: '💍 Proposal Expired', iconURL: message.author.displayAvatarURL() })
          .setDescription(`<@${message.author.id}>'s proposal to <@${target.id}> has expired. 💨`)
          .setTimestamp();
        proposalMsg.edit({ embeds: [expiredEmbed], components: [] }).catch(() => {});
      }, 60000);

    } catch (err) { console.error(err); message.reply('Error running marry command.'); }
  }

  // ─── DIVORCE ─────────────────────────────────────────────
  if (command === 'divorce') {
    try {
      const marriages = loadMarriages();
      const guildKey = message.guild.id;

      if (!marriages[guildKey]?.[message.author.id]) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Not Married' })
          .setDescription('<:flash:1487027526394974218> **You\'re not married to anyone!**')
          .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const spouseId = marriages[guildKey][message.author.id];
      delete marriages[guildKey][message.author.id];
      delete marriages[guildKey][spouseId];
      saveMarriages(marriages);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: '💔 Divorced', iconURL: message.author.displayAvatarURL() })
        .setDescription(`<@${message.author.id}> and <@${spouseId}> are no longer married. 💔`)
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply('Error running divorce command.'); }
  }

  // ─── BANLIST ─────────────────────────────────────────────
  if (command === 'banlist') {
    try {
      if (!message.member.permissions.has('BanMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('view the ban list for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const bans = await message.guild.bans.fetch();
      if (bans.size === 0) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${message.guild.name} — Ban List`, iconURL: message.guild.iconURL() })
          .setDescription('<:tick:1487030751550509066> No users are currently banned.')
          .setTimestamp()
        ], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
      }

      const perPage = 10;
      const pages   = Math.ceil(bans.size / perPage);
      const banArr  = [...bans.values()];
      const chunk   = banArr.slice(0, perPage);

      const desc = chunk.map((b, i) =>
        `\`${i + 1}.\` **${b.user.tag}** — ${b.reason || 'No reason provided'}`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xff3b3b)
        .setAuthor({ name: `${message.guild.name} — Ban List`, iconURL: message.guild.iconURL() })
        .setDescription(desc)
        .setFooter({ text: `${bans.size} total ban${bans.size === 1 ? '' : 's'}  •  Page 1 of ${pages}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply('Error fetching ban list.'); }
  }

  // ─── WARNLIST ────────────────────────────────────────────
  if (command === 'warnlist') {
    try {
      if (!message.member.permissions.has('ModerateMembers')) {
        return message.channel.send({
          embeds: [noPermsEmbed('view the warn list for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const warns   = loadWarns();
      const entries = Object.entries(warns)
        .filter(([key, list]) => key.startsWith(message.guild.id) && list.length > 0)
        .map(([key, list]) => ({ userId: key.split('_')[1], count: list.length }))
        .sort((a, b) => b.count - a.count);

      if (entries.length === 0) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${message.guild.name} — Warn List`, iconURL: message.guild.iconURL() })
          .setDescription('<:tick:1487030751550509066> No members currently have warnings.')
          .setTimestamp()
        ], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
      }

      const desc = entries.slice(0, 15).map((e, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
        return `${medal} <@${e.userId}> — **${e.count}** warning${e.count === 1 ? '' : 's'}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setAuthor({ name: `${message.guild.name} — Warn List`, iconURL: message.guild.iconURL() })
        .setDescription(desc)
        .setFooter({ text: `${entries.length} member${entries.length === 1 ? '' : 's'} with warnings` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply('Error fetching warn list.'); }
  }

  // ─── GAY METER ───────────────────────────────────────────
  if (command === 'gay' || command === 'howgay') {
    try {
      const target = message.mentions.members.first() || message.member;
      const pct    = Math.floor(Math.random() * 101);
      const filled = Math.round(pct / 10);
      const bar    = '🌈'.repeat(filled) + '⬛'.repeat(10 - filled);

      let verdict;
      if (pct >= 95)      verdict = 'Absolutely, undeniably, certified gay. 🏳️‍🌈';
      else if (pct >= 80) verdict = 'Very much so. No questions asked.';
      else if (pct >= 60) verdict = 'More gay than straight, not gonna lie.';
      else if (pct >= 40) verdict = 'Somewhere in the middle... suspicious.';
      else if (pct >= 20) verdict = 'Mostly straight but we see you.';
      else if (pct >= 5)  verdict = 'Barely registers. Probably straight.';
      else                verdict = 'Completely, utterly, 0% gay.';

      const embed = new EmbedBuilder()
        .setColor(0xff6b9d)
        .setAuthor({ name: '🌈 Gay Meter', iconURL: message.guild.iconURL() })
        .setDescription(`**${target.displayName}** is...\n\n${bar}\n\n**${pct}% gay**\n${verdict}`)
        .setThumbnail(target.user.displayAvatarURL())
        .setFooter({ text: `Requested by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply('Error running gay meter.'); }
  }

  // ─── ANTINUKE TOGGLE ─────────────────────────────────────
  if (command === 'antinuke') {
    if (!message.member.roles.cache.has(FULL_ACCESS_ROLE_ID)) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Missing Permissions' })
          .setDescription('<:flash:1487027526394974218> **Only members with Full Access can toggle Anti-Nuke.**')
          .setTimestamp()],
        components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
      });
    }

    antiNukeEnabled = !antiNukeEnabled;

    const embed = new EmbedBuilder()
      .setColor(antiNukeEnabled ? 0x57F287 : 0xff3b3b)
      .setAuthor({ name: `🛡️ Anti-Nuke ${antiNukeEnabled ? 'Enabled' : 'Disabled'}`, iconURL: message.guild.iconURL() })
      .setDescription(`<:moderator:1487021865682735225> **${message.member.displayName}** has turned Anti-Nuke **${antiNukeEnabled ? 'on' : 'off'}**.`)
      .addFields({ name: 'Status', value: antiNukeEnabled ? '🟢 Active' : '🔴 Disabled', inline: true })
      .setTimestamp();

    message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

    sendLog(message.guild, new EmbedBuilder()
      .setColor(antiNukeEnabled ? 0x57F287 : 0xff3b3b)
      .setTitle(`🛡️ Anti-Nuke ${antiNukeEnabled ? 'Enabled' : 'Disabled'}`)
      .addFields({ name: 'Toggled by', value: `<@${invokerId}>`, inline: true })
      .setTimestamp());
  }

  // ─── ANTIRAID TOGGLE ─────────────────────────────────────
  if (command === 'antiraid') {
    if (!message.member.roles.cache.has(FULL_ACCESS_ROLE_ID)) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Missing Permissions' })
          .setDescription('<:flash:1487027526394974218> **Only members with Full Access can toggle Anti-Raid.**')
          .setTimestamp()],
        components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
      });
    }

    antiRaidEnabled = !antiRaidEnabled;

    const embed = new EmbedBuilder()
      .setColor(antiRaidEnabled ? 0x57F287 : 0xff3b3b)
      .setAuthor({ name: `🚨 Anti-Raid ${antiRaidEnabled ? 'Enabled' : 'Disabled'}`, iconURL: message.guild.iconURL() })
      .setDescription(`<:moderator:1487021865682735225> **${message.member.displayName}** has turned Anti-Raid **${antiRaidEnabled ? 'on' : 'off'}**.`)
      .addFields({ name: 'Status', value: antiRaidEnabled ? '🟢 Active' : '🔴 Disabled', inline: true })
      .setTimestamp();

    message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

    sendLog(message.guild, new EmbedBuilder()
      .setColor(antiRaidEnabled ? 0x57F287 : 0xff3b3b)
      .setTitle(`🚨 Anti-Raid ${antiRaidEnabled ? 'Enabled' : 'Disabled'}`)
      .addFields({ name: 'Toggled by', value: `<@${invokerId}>`, inline: true })
      .setTimestamp());
  }

  // ─── ENDRAID ─────────────────────────────────────────────
  if (command === 'endraid') {
    if (!message.member.permissions.has('Administrator')) {
      return message.channel.send({
        embeds: [noPermsEmbed('end the raid lockdown for')],
        components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
      });
    }

    if (!raidLocked) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0x2b2d31)
          .setDescription('<:tick:1487030751550509066> There is no active raid lockdown.')
          .setTimestamp()],
        components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
      });
    }

    raidLocked = false;
    raidJoinTimes.length = 0;

    const textChannels = message.guild.channels.cache.filter(c => c.type === 0);
    for (const [, ch] of textChannels) {
      try { await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }); } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: '✅ Raid Lockdown Ended', iconURL: message.guild.iconURL() })
      .setDescription('All channels have been unlocked. The server is back to normal.')
      .addFields({ name: '<:moderator:1487021865682735225> Ended by', value: `<@${invokerId}>`, inline: true })
      .setTimestamp();

    message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

    sendLog(message.guild, new EmbedBuilder()
      .setColor(0x57F287).setTitle('✅ Raid Lockdown Ended')
      .addFields({ name: 'Ended by', value: `<@${invokerId}>`, inline: true })
      .setTimestamp());
  }

  // ─── STEAL ───────────────────────────────────────────────
  if (command === 'steal') {
    try {
      const hasModRole = message.member.roles.cache.has('1484500406959607808') || message.member.roles.highest.position >= (message.guild.roles.cache.get('1484500406959607808')?.position || 0);
      if (!hasModRole) {
        return message.channel.send({
          embeds: [noPermsEmbed('steal emojis or stickers for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      if (!message.reference) {
        return message.reply('You need to **reply to a message** that contains a custom emoji or sticker. Usage: `.steal <n>`');
      }

      const emojiName = args[1];
      if (!emojiName || !/^[a-zA-Z0-9_]+$/.test(emojiName)) {
        return message.reply('Provide a valid name (letters, numbers, underscores only). Usage: `.steal <n>`');
      }

      const replied = await message.channel.messages.fetch(message.reference.messageId);

      if (replied.stickers?.size > 0) {
        const sticker = replied.stickers.first();
        if (sticker.format === 3) return message.reply('Lottie (animated) stickers cannot be stolen — Discord restriction.');
        try {
          await message.guild.stickers.create({
            file: sticker.url,
            name: emojiName,
            tags: emojiName,
            description: `Stolen by ${message.author.tag}`
          });
          return message.channel.send({ embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setAuthor({ name: 'Sticker Stolen!', iconURL: message.guild.iconURL() })
            .setDescription(`<:tick:1487030751550509066> Sticker **${emojiName}** added to the server.`)
            .setThumbnail(sticker.url)
            .setTimestamp()
          ], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
        } catch (e) {
          return message.reply(`Failed to steal sticker: ${e.message}`);
        }
      }

      const emojiMatch = replied.content.match(/<a?:([^:]+):(\d+)>/);
      if (!emojiMatch) {
        return message.reply('No custom emoji or sticker found in that message. Only custom emojis can be stolen (not default ones).');
      }

      const animated  = emojiMatch[0].startsWith('<a:');
      const emojiId   = emojiMatch[2];
      const ext       = animated ? 'gif' : 'png';
      const emojiUrl  = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;

      try {
        const newEmoji = await message.guild.emojis.create({ attachment: emojiUrl, name: emojiName });
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({ name: 'Emoji Stolen!', iconURL: message.guild.iconURL() })
          .setDescription(`<:tick:1487030751550509066> Emoji **${newEmoji.toString()}** added to the server as \`:${emojiName}:\``)
          .setThumbnail(emojiUrl)
          .setTimestamp()
        ], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
      } catch (e) {
        return message.reply(`Failed to steal emoji: ${e.message}`);
      }

    } catch (err) { console.error(err); message.reply('Error running steal command.'); }
  }

  // ─── UPLOAD EMOJI / STICKER ──────────────────────────────
  if (command === 'upload') {
    try {
      const hasModRole = message.member.roles.cache.has('1484500406959607808') || message.member.roles.highest.position >= (message.guild.roles.cache.get('1484500406959607808')?.position || 0);
      if (!hasModRole) {
        return message.channel.send({
          embeds: [noPermsEmbed('upload emojis or stickers for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const type = args[1]?.toLowerCase();
      const name = args[2];

      if (!type || !['emoji', 'sticker'].includes(type)) {
        return message.reply('Usage: `.upload emoji <name>` or `.upload sticker <name>`');
      }
      if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
        return message.reply('Provide a valid name (letters, numbers, underscores only).');
      }
      if (!message.reference) {
        return message.reply('You need to **reply to a message** that contains an image.');
      }

      const replied = await message.channel.messages.fetch(message.reference.messageId);
      const imageAttachment = replied.attachments.find(a => a.contentType?.startsWith('image/'));

      if (!imageAttachment) {
        return message.reply('No image found in the replied message. Make sure you reply to a message with an image attached.');
      }

      if (type === 'emoji') {
        try {
          const newEmoji = await message.guild.emojis.create({ attachment: imageAttachment.url, name });
          return message.channel.send({
            embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setAuthor({ name: 'Emoji Uploaded!', iconURL: message.guild.iconURL() })
              .setDescription(`<:tick:1487030751550509066> Emoji **${newEmoji.toString()}** added to the server as \`:${name}:\``)
              .setThumbnail(imageAttachment.url)
              .addFields(
                { name: '<:moderator:1487021865682735225> Uploaded by', value: `<@${invokerId}>`, inline: true },
                { name: '<:reason:1487022066644291614> Name', value: `:${name}:`, inline: true }
              )
              .setTimestamp()],
            components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
          });
        } catch (e) {
          return message.reply(`Failed to upload emoji: ${e.message}`);
        }
      }

      if (type === 'sticker') {
        try {
          const newSticker = await message.guild.stickers.create({
            file: imageAttachment.url,
            name,
            tags: name,
            description: `Uploaded by ${message.author.tag}`
          });
          return message.channel.send({
            embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setAuthor({ name: 'Sticker Uploaded!', iconURL: message.guild.iconURL() })
              .setDescription(`<:tick:1487030751550509066> Sticker **${name}** added to the server.`)
              .setThumbnail(imageAttachment.url)
              .addFields(
                { name: '<:moderator:1487021865682735225> Uploaded by', value: `<@${invokerId}>`, inline: true },
                { name: '<:reason:1487022066644291614> Name', value: name, inline: true }
              )
              .setTimestamp()],
            components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
          });
        } catch (e) {
          return message.reply(`Failed to upload sticker: ${e.message}`);
        }
      }

    } catch (err) { console.error(err); message.reply('Error running upload command.'); }
  }

  // ─── MESSAGE COUNT ────────────────────────────────────────
  if (command === 'm' || command === 'message' || command === 'messages') {
    try {
      const target = args[1] ? await resolveMember(message.guild, args[1]) : message.member;
      if (!target) return message.reply("User not found.");

      const msgData = loadMsgData();
      const daily   = loadDailyData();
      const todayIST = getTodayIST();
      if (daily.date !== todayIST) { daily.date = todayIST; daily.counts = {}; }

      const gKey      = message.guild.id;
      const allTime   = (msgData[gKey]?.[target.id] || 0);
      const todayCount = (daily.counts[gKey]?.[target.id] || 0);

      // Rank calculation
      const allEntries = Object.entries(msgData[gKey] || {}).sort((a,b) => b[1]-a[1]);
      const rank = allEntries.findIndex(([id]) => id === target.id) + 1;

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${target.displayName}'s Messages`, iconURL: target.user.displayAvatarURL() })
        .addFields(
          { name: '<:user:1487021741720076309> All Time', value: `**${allTime.toLocaleString()}** messages`, inline: true },
          { name: '📅 Today', value: `**${todayCount.toLocaleString()}** messages`, inline: true },
          { name: '🏆 Rank', value: rank > 0 ? `**#${rank}**` : 'Unranked', inline: true }
        )
        .setFooter({ text: `Tracking since bot joined · ${message.guild.name}` })
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
    } catch (err) { console.error(err); message.reply("Error fetching message count."); }
  }

  // ─── LEADERBOARDS ─────────────────────────────────────────
  const lbAliases = ['lb', 'leaderboard'];
  if (lbAliases.includes(command)) {
    const sub = args[1]?.toLowerCase();
    const msgSubs = ['m', 'message', 'messages'];
    const dailySubs = ['dm', 'dailymessage', 'dailymessages', 'daily'];

    if (msgSubs.includes(sub)) {
      // All-time message leaderboard
      try {
        const msgData = loadMsgData();
        const gKey = message.guild.id;
        const entries = Object.entries(msgData[gKey] || {}).sort((a,b) => b[1]-a[1]);
        if (entries.length === 0) return message.reply("No messages tracked yet!");

        const PAGE_SIZE = 10;
        const totalPages = Math.ceil(entries.length / PAGE_SIZE);

        async function buildLbEmbed(page) {
          const slice = entries.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
          const lines = await Promise.all(slice.map(async ([uid, count], i) => {
            const rank = page * PAGE_SIZE + i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;
            let name;
            try {
              const mem = await message.guild.members.fetch(uid).catch(() => null);
              name = mem ? mem.displayName : `<@${uid}>`;
            } catch { name = `<@${uid}>`; }
            return `${medal} ${name} — **${count.toLocaleString()}** messages`;
          }));

          return new EmbedBuilder()
            .setColor(0x2b2d31)
            .setAuthor({ name: `${message.guild.name} — Message Leaderboard`, iconURL: message.guild.iconURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Page ${page+1}/${totalPages} · ${entries.length} members tracked` })
            .setTimestamp();
        }

        let page = 0;
        const embed = await buildLbEmbed(page);
        const makeRow = (p) => new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`lb_first_${p}_${invokerId}`).setLabel('⏮').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`lb_prev_${p}_${invokerId}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`lb_next_${p}_${invokerId}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
          new ButtonBuilder().setCustomId(`lb_last_${p}_${invokerId}`).setLabel('⏭').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
          makeDeleteBtn(invokerId)
        );

        message.channel.send({ embeds: [embed], components: [makeRow(page)], _lbMeta: { type: 'alltime', totalPages, entries: entries.map(([id,c])=>({id,c})) } });
      } catch (err) { console.error(err); message.reply("Error loading leaderboard."); }

    } else if (dailySubs.includes(sub)) {
      // Daily message leaderboard
      try {
        const daily = loadDailyData();
        const todayIST = getTodayIST();
        if (daily.date !== todayIST) { daily.date = todayIST; daily.counts = {}; }
        const gKey = message.guild.id;
        const entries = Object.entries(daily.counts[gKey] || {}).sort((a,b) => b[1]-a[1]);
        if (entries.length === 0) return message.reply("No messages tracked today yet!");

        const PAGE_SIZE = 10;
        const totalPages = Math.ceil(entries.length / PAGE_SIZE);

        async function buildDailyEmbed(page) {
          const slice = entries.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
          const lines = await Promise.all(slice.map(async ([uid, count], i) => {
            const rank = page * PAGE_SIZE + i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;
            let name;
            try {
              const mem = await message.guild.members.fetch(uid).catch(() => null);
              name = mem ? mem.displayName : `<@${uid}>`;
            } catch { name = `<@${uid}>`; }
            return `${medal} ${name} — **${count.toLocaleString()}** messages today`;
          }));

          return new EmbedBuilder()
            .setColor(0x2b2d31)
            .setAuthor({ name: `${message.guild.name} — Daily Message Leaderboard`, iconURL: message.guild.iconURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Page ${page+1}/${totalPages} · Resets at midnight IST` })
            .setTimestamp();
        }

        let page = 0;
        const embed = await buildDailyEmbed(page);
        const makeRow = (p) => new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`dlb_first_${p}_${invokerId}`).setLabel('⏮').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`dlb_prev_${p}_${invokerId}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`dlb_next_${p}_${invokerId}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
          new ButtonBuilder().setCustomId(`dlb_last_${p}_${invokerId}`).setLabel('⏭').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
          makeDeleteBtn(invokerId)
        );

        message.channel.send({ embeds: [embed], components: [makeRow(page)] });
      } catch (err) { console.error(err); message.reply("Error loading daily leaderboard."); }
    }
  }

});

// ─────────────────────────────────────────────────────────────
// BUTTON & MODAL INTERACTIONS
// ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  // ——— BUTTONS ———
  if (interaction.isButton()) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const embeddedInvokerId = parts[parts.length - 1];

    // ─── HELP NAV ─────────────────────────────────────────
    if (customId.startsWith('help_')) {
      if (interaction.user.id !== embeddedInvokerId) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xff3b3b)
            .setAuthor({ name: 'Not Your Menu' })
            .setDescription("<:flash:1487027526394974218> **This help menu belongs to someone else.**\n\nRun `.help` yourself to get your own.")
            .setTimestamp()],
          ephemeral: true
        });
      }

      const action = parts[1];
      const currentPage = parseInt(parts[2]);
      let newPage = currentPage;

      if (action === 'next') newPage = Math.min(currentPage + 1, helpPages.length - 1);
      else if (action === 'prev') newPage = Math.max(currentPage - 1, 0);
      else if (action === 'overview') newPage = 0;

      const embed = helpPages[newPage](interaction.guild);
      const row = makeHelpRow(newPage, embeddedInvokerId);
      return interaction.update({ embeds: [embed], components: [row] });
    }

    // ─── MARRY ACCEPT / DECLINE ───────────────────────────
    if (customId.startsWith('marry_accept_') || customId.startsWith('marry_decline_')) {
      // customId: marry_accept_proposerId_targetId
      const proposerId = parts[2];
      const targetId   = parts[3];

      if (interaction.user.id !== targetId) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xff3b3b)
            .setAuthor({ name: 'Not For You 💍' })
            .setDescription('<:flash:1487027526394974218> **Only the person being proposed to can respond to this.**')
            .setTimestamp()],
          ephemeral: true
        });
      }

      if (customId.startsWith('marry_decline_')) {
        const declinedEmbed = new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: '💔 Proposal Declined', iconURL: interaction.user.displayAvatarURL() })
          .setDescription(`<@${targetId}> has declined <@${proposerId}>'s proposal. 💔`)
          .setTimestamp();
        return interaction.update({ embeds: [declinedEmbed], components: [] });
      }

      // Accept
      const marriages = loadMarriages();
      const guildKey  = interaction.guild.id;
      if (!marriages[guildKey]) marriages[guildKey] = {};

      if (marriages[guildKey][proposerId] || marriages[guildKey][targetId]) {
        const alreadyEmbed = new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Already Married 💍' })
          .setDescription('<:flash:1487027526394974218> **One of you is already married to someone else!**')
          .setTimestamp();
        return interaction.update({ embeds: [alreadyEmbed], components: [] });
      }

      marriages[guildKey][proposerId] = targetId;
      marriages[guildKey][targetId]   = proposerId;
      saveMarriages(marriages);

      const marriedAt = Math.floor(Date.now() / 1000);

      const acceptedEmbed = new EmbedBuilder()
        .setColor(0xff6b9d)
        .setAuthor({ name: '💍 Just Married!', iconURL: interaction.user.displayAvatarURL() })
        .setDescription(
          `**<@${proposerId}> & <@${targetId}> are now married!** 🎉\n\n` +
          `💒 May your days together be blessed.\n` +
          `💍 Married on <t:${marriedAt}:F>`
        )
        .setFooter({ text: 'Use .divorce to end the marriage.' })
        .setTimestamp();

      return interaction.update({ embeds: [acceptedEmbed], components: [] });
    }

    // ─── ALL OTHER BUTTONS ────────────────────────────────
    if (interaction.user.id !== embeddedInvokerId) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Not Your Button' })
          .setDescription("<:flash:1487027526394974218> **You can't interact with this button.**\n\nIt belongs to the person who ran the original command.")
          .setTimestamp()],
        ephemeral: true
      });
    }

    if (customId.startsWith('delete_msg_')) {
      return interaction.message.delete();
    }

    // ─── LEADERBOARD PAGINATION ───────────────────────────
    if (customId.startsWith('lb_') || customId.startsWith('dlb_')) {
      const isDaily = customId.startsWith('dlb_');
      const parts2 = customId.split('_');
      // format: lb_action_currentPage_invokerId or dlb_action_currentPage_invokerId
      const action = parts2[1];
      const currentPage = parseInt(parts2[2]);
      const gKey = interaction.guild.id;

      const msgData = loadMsgData();
      const daily = loadDailyData();
      const todayIST = getTodayIST();
      if (daily.date !== todayIST) { daily.date = todayIST; daily.counts = {}; }

      const entries = isDaily
        ? Object.entries(daily.counts[gKey] || {}).sort((a,b) => b[1]-a[1])
        : Object.entries(msgData[gKey] || {}).sort((a,b) => b[1]-a[1]);

      const PAGE_SIZE = 10;
      const totalPages = Math.ceil(entries.length / PAGE_SIZE);

      let newPage = currentPage;
      if (action === 'first') newPage = 0;
      else if (action === 'prev') newPage = Math.max(0, currentPage - 1);
      else if (action === 'next') newPage = Math.min(totalPages - 1, currentPage + 1);
      else if (action === 'last') newPage = totalPages - 1;

      const slice = entries.slice(newPage * PAGE_SIZE, (newPage+1) * PAGE_SIZE);
      const lines = await Promise.all(slice.map(async ([uid, count], i) => {
        const rank = newPage * PAGE_SIZE + i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;
        let name;
        try {
          const mem = await interaction.guild.members.fetch(uid).catch(() => null);
          name = mem ? mem.displayName : `<@${uid}>`;
        } catch { name = `<@${uid}>`; }
        return `${medal} ${name} — **${count.toLocaleString()}** messages${isDaily ? ' today' : ''}`;
      }));

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
          name: `${interaction.guild.name} — ${isDaily ? 'Daily ' : ''}Message Leaderboard`,
          iconURL: interaction.guild.iconURL()
        })
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Page ${newPage+1}/${totalPages} · ${isDaily ? 'Resets at midnight IST' : `${entries.length} members tracked`}` })
        .setTimestamp();

      const prefix2 = isDaily ? 'dlb' : 'lb';
      const makeRow = (p) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${prefix2}_first_${p}_${embeddedInvokerId}`).setLabel('⏮').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId(`${prefix2}_prev_${p}_${embeddedInvokerId}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId(`${prefix2}_next_${p}_${embeddedInvokerId}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
        new ButtonBuilder().setCustomId(`${prefix2}_last_${p}_${embeddedInvokerId}`).setLabel('⏭').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
        makeDeleteBtn(embeddedInvokerId)
      );

      return interaction.update({ embeds: [embed], components: [makeRow(newPage)] });
    }

    // ─── TD REROLL ────────────────────────────────────────
    if (customId.startsWith('td_reroll_')) {
      const data = getRandomTD();
      const member = interaction.member;
      const embed = makeTDEmbed(data, member);
      const row = makeTDRow(embeddedInvokerId);
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId.startsWith('unmute_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder().setCustomId(`unmute_modal_${targetId}_${embeddedInvokerId}`).setTitle('Unmute Reason');
      const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason for Unmuting').setPlaceholder('Provide a reason to unmute or leave it blank.').setStyle(TextInputStyle.Paragraph).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }

    if (customId.startsWith('mute_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder().setCustomId(`mute_modal_${targetId}_${embeddedInvokerId}`).setTitle('Mute Reason');
      const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason for Muting').setPlaceholder('Provide a reason to mute or leave it blank.').setStyle(TextInputStyle.Paragraph).setRequired(false);
      const durationInput = new TextInputBuilder().setCustomId('duration').setLabel('Duration (e.g. 10m, 1h, 1d)').setPlaceholder('Leave blank for 24h default').setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(durationInput), new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }

    if (customId.startsWith('unban_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder().setCustomId(`unban_modal_${targetId}_${embeddedInvokerId}`).setTitle('Unban Reason');
      const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason for Unbanning').setPlaceholder('Provide a reason to unban or leave it blank.').setStyle(TextInputStyle.Paragraph).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }

    if (customId.startsWith('ban_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder().setCustomId(`ban_modal_${targetId}_${embeddedInvokerId}`).setTitle('Ban Reason');
      const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason for Banning').setPlaceholder('Provide a reason to ban or leave it blank.').setStyle(TextInputStyle.Paragraph).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }
  }

  // ——— MODALS ———
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const embeddedInvokerId = parts[parts.length - 1];
    const targetId = parts[2];

    if (interaction.user.id !== embeddedInvokerId) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff3b3b)
          .setAuthor({ name: 'Not Your Action' })
          .setDescription("<:flash:1487027526394974218> **You didn't run the original command.**")
          .setTimestamp()],
        ephemeral: true
      });
    }

    const reason = interaction.fields.getTextInputValue('reason') || "No reason provided";

    await interaction.deferUpdate();

    if (customId.startsWith('unmute_modal_')) {
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.timeout(null);

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${member.user.tag} has been unmuted`, iconURL: member.user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

        member.user.send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(
`<:tick:1487030751550509066> **You have been unmuted**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>`
        ).setTimestamp()] }).catch(() => {});

        sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0x57F287).setTitle('🔊 Member Unmuted (via button)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
          ).setTimestamp());
      } catch (err) { console.error(err); }
    }

    if (customId.startsWith('mute_modal_')) {
      try {
        const member = await interaction.guild.members.fetch(targetId);
        const durationRaw = interaction.fields.getTextInputValue('duration') || "24h";
        const ms = parseTime(durationRaw) || 24 * 60 * 60 * 1000;
        const timeArg = durationRaw || "24h";

        await member.timeout(ms);

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${member.user.tag} has been muted`, iconURL: member.user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>`, inline: true },
            { name: "<:duration:1487022019273953300> Duration", value: timeArg, inline: true },
            { name: "<:reason:1487022066644291614> Reason", value: reason }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

        member.user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription(
`<:flash:1487027526394974218> **You have been muted**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>  
<:duration:1487022019273953300> Duration: ${timeArg}  
<:reason:1487022066644291614> Reason: ${reason}`
        ).setTimestamp()] }).catch(() => {});

        sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('🔇 Member Muted (via button)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Duration', value: timeArg, inline: true },
            { name: 'Reason', value: reason }
          ).setTimestamp());
      } catch (err) { console.error(err); }
    }

    if (customId.startsWith('unban_modal_')) {
      try {
        const user = await client.users.fetch(targetId);
        await interaction.guild.members.unban(targetId, reason);

        let invite;
        try {
          const channel = interaction.guild.channels.cache.find(c => c.type === 0);
          invite = await channel.createInvite({ maxAge: 0, maxUses: 1 });
        } catch { invite = null; }

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${user.tag} has been unbanned`, iconURL: user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
            { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>` }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

        user.send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(
`<:tick:1487030751550509066> **You have been unbanned**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>  
<:reason:1487022066644291614> Reason: ${reason}

${invite ? `<:Links:1487353216235737240> **Rejoin:** ${invite.url}` : ""}`
        ).setTimestamp()] }).catch(() => {});

        sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0x57F287).setTitle('✅ Member Unbanned (via button)')
          .addFields(
            { name: 'User', value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason }
          ).setTimestamp());
      } catch (err) { console.error(err); }
    }

    if (customId.startsWith('ban_modal_')) {
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.ban({ reason });

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${member.user.tag} has been banned`, iconURL: member.user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
            { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>` }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

        member.user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription(
`<:flash:1487027526394974218> **You have been banned**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>  
<:reason:1487022066644291614> Reason: ${reason}`
        ).setTimestamp()] }).catch(() => {});

        sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('🔨 Member Banned (via button)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason }
          ).setTimestamp());
      } catch (err) { console.error(err); }
    }
  }
});

// ─── GUILD MEMBER ADD (ANTI-RAID + BOT DETECTION) ────────────
// Maps botId -> adderId so we can ban the adder if the bot nukes
const botAdderMap = new Map();

client.on('guildMemberAdd', async member => {
  // ── Bot-add detection ────────────────────────────────────────
  if (member.user.bot) {
    try {
      const logs = await member.guild.fetchAuditLogs({ type: 28 /* BOT_ADD */, limit: 1 });
      const entry = logs.entries.first();
      const adderId = entry?.executor?.id;

      if (adderId && adderId !== client.user.id) {
        // Remember who added this bot
        botAdderMap.set(member.id, adderId);

        // DM Poltergeist immediately
        try {
          const owner = await client.users.fetch(NUKE_OWNER_ID);
          await owner.send({ embeds: [new EmbedBuilder()
            .setColor(0xffa500)
            .setAuthor({ name: '⚠️ New Bot Added', iconURL: member.guild.iconURL() })
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(`A new bot was just added to **${member.guild.name}**.`)
            .addFields(
              { name: '🤖 Bot', value: `<@${member.id}>\n**Tag:** ${member.user.tag}\n**ID:** ${member.id}`, inline: true },
              { name: '<:user:1487021741720076309> Added By', value: `<@${adderId}>\n**ID:** ${adderId}`, inline: true },
              { name: '🔗 Server', value: `${member.guild.name} (${member.guild.id})` }
            ).setTimestamp()] });
        } catch {}
      }
    } catch {}
    return; // don't run raid check for bots
  }

  handleRaidJoin(member);
});

// ─── AUDIT LOG LISTENERS (ANTI-NUKE) ─────────────────────────
client.on('guildBanAdd', async (ban) => {
  if (!antiNukeEnabled) return;
  try {
    const logs = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return;
    const executorId = entry.executor.id;
    if (executorId === client.user.id) return;
    if (await isImmune(ban.guild, executorId)) return;

    // ── Fast nuke tracker ────────────────────────────────────
    const data = getNukeData(executorId);
    if (!data._bannedUsers) data._bannedUsers = [];
    data._bannedUsers.push(ban.user.id);
    data.bans.push(Date.now());
    data.bans = pruneOld(data.bans);
    if (data.bans.length >= 3) {
      await executeNuke(ban.guild, executorId, `Mass Ban (${data.bans.length} bans in 10s)`);
      return;
    }

    // ── Slow nuke tracker ────────────────────────────────────
    if (!(await isManagerOrAbove(ban.guild, executorId))) {
      const slow = getSlowData(executorId);
      slow.bannedUsers.push(ban.user.id);
      slow.bans = pruneSlowOld(slow.bans);
      const isRepeat = slow.bans.length >= 1;
      slow.bans.push(Date.now());

      const member = ban.guild.members.cache.get(executorId);
      const tag = member?.user?.tag || executorId;

      try {
        const owner = await client.users.fetch(NUKE_OWNER_ID);
        await owner.send({ embeds: [new EmbedBuilder()
          .setColor(isRepeat ? 0xff6600 : 0xffa500)
          .setAuthor({ name: isRepeat ? '🚨 Repeat Ban (Slow Nuke)' : '⚠️ Ban by Non-Manager', iconURL: ban.guild.iconURL() })
          .setDescription(isRepeat
            ? `This is their **2nd+ ban within 8 hours** in **${ban.guild.name}**. Roles are being stripped.`
            : `A non-manager issued a ban in **${ban.guild.name}**.`)
          .addFields(
            { name: '<:user:1487021741720076309> Banned User', value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
            { name: '<:moderator:1487021865682735225> By', value: `<@${executorId}> (${tag})`, inline: true },
            { name: '🕐 Bans in Last 8h', value: `${slow.bans.length}`, inline: true }
          ).setTimestamp()] });
      } catch {}

      if (isRepeat) {
        await executeSlowNuke(ban.guild, executorId, `Repeat Ban (${slow.bans.length} in 8h)`);
      }
    }
  } catch (err) { console.error('[Anti-Nuke]', err); }
});

client.on('guildMemberRemove', async member => {
  if (antiNukeEnabled) {
    try {
      const logs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.executor.id !== client.user.id && Date.now() - entry.createdTimestamp < 3000) {
        const executorId = entry.executor.id;
        if (!(await isImmune(member.guild, executorId))) {
          // ── Fast nuke tracker ──────────────────────────────
          const data = getNukeData(executorId);
          data.kicks.push(Date.now());
          data.kicks = pruneOld(data.kicks);
          if (data.kicks.length >= 3) {
            await executeNuke(member.guild, executorId, `Mass Kick (${data.kicks.length} kicks in 10s)`);
          } else if (!(await isManagerOrAbove(member.guild, executorId))) {
            // ── Slow nuke tracker ──────────────────────────
            const slow = getSlowData(executorId);
            slow.kicks = pruneSlowOld(slow.kicks);
            const isRepeat = slow.kicks.length >= 1;
            slow.kicks.push(Date.now());

            const kickerMember = member.guild.members.cache.get(executorId);
            const tag = kickerMember?.user?.tag || executorId;

            try {
              const owner = await client.users.fetch(NUKE_OWNER_ID);
              await owner.send({ embeds: [new EmbedBuilder()
                .setColor(isRepeat ? 0xff6600 : 0xffa500)
                .setAuthor({ name: isRepeat ? '🚨 Repeat Kick (Slow Nuke)' : '⚠️ Kick by Non-Manager', iconURL: member.guild.iconURL() })
                .setDescription(isRepeat
                  ? `This is their **2nd+ kick within 8 hours** in **${member.guild.name}**. Roles are being stripped.`
                  : `A non-manager kicked someone in **${member.guild.name}**.`)
                .addFields(
                  { name: '<:user:1487021741720076309> Kicked User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
                  { name: '<:moderator:1487021865682735225> By', value: `<@${executorId}> (${tag})`, inline: true },
                  { name: '🕐 Kicks in Last 8h', value: `${slow.kicks.length}`, inline: true }
                ).setTimestamp()] });
            } catch {}

            if (isRepeat) {
              await executeSlowNuke(member.guild, executorId, `Repeat Kick (${slow.kicks.length} in 8h)`);
            }
          }
        }
      }
    } catch {}
  }

  // ─── LEAVE DM (existing) ─────────────────────────────────
  try {
    try { const ban = await member.guild.bans.fetch(member.id); if (ban) return; } catch {}
    try {
      const logs = await member.guild.fetchAuditLogs({ type: 20, limit: 5 });
      const kickEntry = logs.entries.find(e => e.target.id === member.id && Date.now() - e.createdTimestamp < 5000);
      if (kickEntry) return;
    } catch {}

    let invite;
    try {
      const channel = member.guild.channels.cache.find(c => c.type === 0);
      invite = await channel.createInvite({ maxAge: 604800, maxUses: 1 });
    } catch { invite = null; }

    let dmStatus = "No";
    try {
      await member.user.send({ embeds: [new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: member.guild.name, iconURL: member.guild.iconURL() })
        .setDescription(`**Hey ${member.user.username}, we noticed you left.**\n\nYour presence in the server mattered and you'll be missed.`)
        .setTimestamp()] });
      if (invite) await member.user.send(`<:Links:1487353216235737240> **Rejoin anytime:** ${invite.url}`);
      dmStatus = "Yes";
    } catch { dmStatus = "No"; }

    sendLog(member.guild, new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: `${member.user.tag} left the server`, iconURL: member.user.displayAvatarURL() })
      .addFields(
        { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
        { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true }
      ).setTimestamp());
  } catch (err) { console.error('[Anti-Nuke]', err); }
});

client.on('channelDelete', async channel => {
  if (!antiNukeEnabled) return;
  try {
    const logs = await channel.guild.fetchAuditLogs({ type: 12, limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return;
    const executorId = entry.executor.id;
    if (executorId === client.user.id) return;
    if (await isImmune(channel.guild, executorId)) return;

    // Build snapshot (shared by fast + slow trackers)
    const snapshot = {
      name: channel.name,
      type: channel.type,
      topic: channel.topic || undefined,
      nsfw: channel.nsfw || false,
      bitrate: channel.bitrate || undefined,
      userLimit: channel.userLimit || undefined,
      rateLimitPerUser: channel.rateLimitPerUser || undefined,
      parentId: channel.parentId || undefined,
      position: channel.rawPosition,
      permissionOverwrites: channel.permissionOverwrites?.cache.map(o => ({
        id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString()
      })) || []
    };

    // ── Fast nuke (2 deletions in 10s) ───────────────────────
    const data = getNukeData(executorId);
    data._deletedChannels.push(snapshot);
    data.channelDeletes.push(Date.now());
    data.channelDeletes = pruneOld(data.channelDeletes);
    if (data.channelDeletes.length >= 2) {
      await executeNuke(channel.guild, executorId, `Mass Channel Delete (${data.channelDeletes.length} in 10s)`);
      return;
    }

    // ── Slow nuke — only applies to users below Manager ──────
    if (!(await isManagerOrAbove(channel.guild, executorId))) {
      const slow = getSlowData(executorId);
      slow.snapChannels.push(snapshot);
      slow.channelDeletes = pruneSlowOld(slow.channelDeletes);
      const isRepeat = slow.channelDeletes.length >= 1; // already deleted one in the last 8h
      slow.channelDeletes.push(Date.now());

      const member = channel.guild.members.cache.get(executorId);
      const tag = member?.user?.tag || executorId;

      // DM Poltergeist on EVERY channel delete by a non-manager
      try {
        const owner = await client.users.fetch(NUKE_OWNER_ID);
        await owner.send({ embeds: [new EmbedBuilder()
          .setColor(isRepeat ? 0xff6600 : 0xffa500)
          .setAuthor({ name: isRepeat ? '🚨 Repeat Channel Delete (Slow Nuke)' : '⚠️ Channel Deleted by Non-Manager', iconURL: channel.guild.iconURL() })
          .setDescription(isRepeat
            ? `This is their **2nd+ deletion within 8 hours** in **${channel.guild.name}**. Roles are being stripped.`
            : `A non-manager deleted a channel in **${channel.guild.name}**.`)
          .addFields(
            { name: '📁 Channel', value: `#${snapshot.name}`, inline: true },
            { name: '<:user:1487021741720076309> Deleted By', value: `<@${executorId}> (${tag})`, inline: true },
            { name: '🕐 Deletes in Last 8h', value: `${slow.channelDeletes.length}`, inline: true }
          ).setTimestamp()] });
      } catch {}

      // On 2nd+ deletion in 8h: strip roles + revert
      if (isRepeat) {
        await executeSlowNuke(channel.guild, executorId, `Repeat Channel Delete (${slow.channelDeletes.length} in 8h)`);
      }
    }
  } catch (err) { console.error('[Anti-Nuke]', err); }
});

client.on('roleDelete', async role => {
  if (!antiNukeEnabled) return;
  try {
    const logs = await role.guild.fetchAuditLogs({ type: 32, limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return;
    const executorId = entry.executor.id;
    if (executorId === client.user.id) return;
    if (await isImmune(role.guild, executorId)) return;

    const snapshot = {
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.rawPosition,
      oldId: role.id,
      memberIds: role.members.map(m => m.id)
    };

    // ── Fast nuke (2 deletions in 10s) ───────────────────────
    const data = getNukeData(executorId);
    data._deletedRoles.push(snapshot);
    data.roleDeletes.push(Date.now());
    data.roleDeletes = pruneOld(data.roleDeletes);
    if (data.roleDeletes.length >= 2) {
      await executeNuke(role.guild, executorId, `Mass Role Delete (${data.roleDeletes.length} in 10s)`);
      return;
    }

    // ── Slow nuke — only applies to users below Manager ──────
    if (!(await isManagerOrAbove(role.guild, executorId))) {
      const slow = getSlowData(executorId);
      slow.snapRoles.push(snapshot);
      slow.roleDeletes = pruneSlowOld(slow.roleDeletes);
      const isRepeat = slow.roleDeletes.length >= 1;
      slow.roleDeletes.push(Date.now());

      const member = role.guild.members.cache.get(executorId);
      const tag = member?.user?.tag || executorId;

      try {
        const owner = await client.users.fetch(NUKE_OWNER_ID);
        await owner.send({ embeds: [new EmbedBuilder()
          .setColor(isRepeat ? 0xff6600 : 0xffa500)
          .setAuthor({ name: isRepeat ? '🚨 Repeat Role Delete (Slow Nuke)' : '⚠️ Role Deleted by Non-Manager', iconURL: role.guild.iconURL() })
          .setDescription(isRepeat
            ? `This is their **2nd+ deletion within 8 hours** in **${role.guild.name}**. Roles are being stripped.`
            : `A non-manager deleted a role in **${role.guild.name}**.`)
          .addFields(
            { name: '🎭 Role', value: `@${snapshot.name}`, inline: true },
            { name: '<:user:1487021741720076309> Deleted By', value: `<@${executorId}> (${tag})`, inline: true },
            { name: '🕐 Deletes in Last 8h', value: `${slow.roleDeletes.length}`, inline: true }
          ).setTimestamp()] });
      } catch {}

      if (isRepeat) {
        await executeSlowNuke(role.guild, executorId, `Repeat Role Delete (${slow.roleDeletes.length} in 8h)`);
      }
    }
  } catch (err) { console.error('[Anti-Nuke]', err); }
});

// ─── HALL OF FAME LISTENER ───────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.name !== '⭐') return;

    const message = reaction.message;
    const guild = message.guild;
    if (!guild) return;

    const starReaction = message.reactions.cache.get('⭐');
    const starCount = starReaction ? starReaction.count : 0;
    if (starCount < STAR_THRESHOLD) return;

    // Don't post the same message twice
    if (starredMessages.has(message.id)) return;
    starredMessages.add(message.id);

    const hofChannel = guild.channels.cache.get(HALL_OF_FAME_CHANNEL_ID);
    if (!hofChannel) return;

    const displayName = message.member?.displayName || message.author.username;
    const avatarURL = message.author.displayAvatarURL();
    const jumpURL = `https://discord.com/channels/${guild.id}/${message.channel.id}/${message.id}`;

    // ── Hall of Fame embed ──
    const hofEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setAuthor({ name: `${displayName}`, iconURL: avatarURL })
      .setDescription(message.content ? `"${message.content}"` : '*No text content*')
      .addFields(
        { name: '⭐ Stars', value: `**${starCount}**`, inline: true },
        { name: '📍 Posted in', value: `<#${message.channel.id}>`, inline: true },
        { name: '🔗 Jump', value: `[Click to view](${jumpURL})`, inline: true }
      )
      .setFooter({ text: `Hall of Fame • ${guild.name}`, iconURL: guild.iconURL() })
      .setTimestamp(message.createdAt);

    const imageAttachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
    if (imageAttachment) hofEmbed.setImage(imageAttachment.url);

    await hofChannel.send({ content: `⭐ **A message just entered the Hall of Fame!**`, embeds: [hofEmbed] });

    // ── In-channel notification ──
    const notifEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setDescription(`⭐ **This message has entered the [Hall of Fame](${jumpURL.replace(`/${message.id}`, '')})!**\nIt reached **${starCount} stars** and has been saved in <#${HALL_OF_FAME_CHANNEL_ID}>.`)
      .setTimestamp();

    await message.channel.send({ embeds: [notifEmbed], reply: { messageReference: message.id, failIfNotExists: false } });

  } catch (err) {
    console.error('Starboard error:', err);
  }
});


// ─── MIDNIGHT IST RESET + HONORED ONE ────────────────────────
function msUntilISTTime(hour, minute) {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const target = new Date(now);
  target.setUTCHours(hour - 5, minute - 30, 0, 0); // convert IST to UTC
  // Actually just compute raw ms to next occurrence
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const targetIST = new Date(nowIST);
  targetIST.setHours(hour, minute, 0, 0);
  if (targetIST <= nowIST) targetIST.setDate(targetIST.getDate() + 1);
  return targetIST - nowIST;
}

async function runMidnightTasks() {
  try {
    // Reset daily messages
    const daily = loadDailyData();
    daily.date = getTodayIST();
    daily.counts = {};
    saveDailyData(daily);
    console.log('[Midnight IST] Daily message counts reset.');
  } catch (e) { console.error('Midnight reset error:', e); }

  // Schedule next midnight
  setTimeout(runMidnightTasks, msUntilISTTime(0, 0));
}

async function runHonoredOne() {
  try {
    for (const [guildId, guild] of client.guilds.cache) {
      const msgData = loadMsgData();
      const entries = Object.entries(msgData[guildId] || {}).sort((a,b) => b[1]-a[1]);
      if (entries.length === 0) continue;

      const topId = entries[0][0];
      const honoredRole = guild.roles.cache.get(HONORED_ROLE_ID);
      if (!honoredRole) continue;

      // Remove from all current holders
      const currentHolders = guild.members.cache.filter(m => m.roles.cache.has(HONORED_ROLE_ID));
      for (const [, member] of currentHolders) {
        if (member.id !== topId) {
          try { await member.roles.remove(honoredRole, 'Honored One: new winner'); } catch {}
        }
      }

      // Add to new top
      const topMember = await guild.members.fetch(topId).catch(() => null);
      if (topMember && !topMember.roles.cache.has(HONORED_ROLE_ID)) {
        try { await topMember.roles.add(honoredRole, 'Honored One: top message sender'); } catch {}
      }

      sendLog(guild, new EmbedBuilder()
        .setColor(0xFFD700)
        .setAuthor({ name: '👑 Honored One Updated', iconURL: guild.iconURL() })
        .setDescription(`<@${topId}> is now the **Honored One** with **${entries[0][1].toLocaleString()} messages**!`)
        .setTimestamp());

      console.log(`[Honored One] Set ${topId} as Honored One in ${guild.name}`);
    }
  } catch (e) { console.error('Honored One error:', e); }

  // Schedule next 11:59 PM IST
  setTimeout(runHonoredOne, msUntilISTTime(23, 59));
}

client.once('ready', () => {
  // Schedule midnight reset
  setTimeout(runMidnightTasks, msUntilISTTime(0, 0));
  // Schedule honored one check
  setTimeout(runHonoredOne, msUntilISTTime(23, 59));
  console.log('[Scheduler] Midnight reset and Honored One scheduled.');
});

client.login(process.env.TOKEN);
