require('dotenv').config();
process.env.FFMPEG_PATH = require('ffmpeg-static');
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
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const prefix = ".";
const fs = require('fs');
const WARNS_FILE = './warnings.json';
const afkMap = new Map();
// ─── MUSIC SETUP ─────────────────────────────────────────────
const MUSIC_CMD_CHANNEL = '1487498685800775701';
const MUSIC_VC_IDS = new Set([
  '1487498945872793781', // MUSIC VC 1
  '1487499828970917958', // MUSIC VC 2
  '1487499872079843480', // MUSIC VC 3
]);

const musicInactivityTimers = new Map();
const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes

function resetInactivityTimer(queue) {
  const vcId = queue.voiceChannel.id;
  if (musicInactivityTimers.has(vcId)) clearTimeout(musicInactivityTimers.get(vcId));
  const handle = setTimeout(async () => {
    try { await queue.stop(); } catch {}
    musicInactivityTimers.delete(vcId);
  }, INACTIVITY_MS);
  musicInactivityTimers.set(vcId, handle);
}

function clearInactivityTimer(vcId) {
  if (musicInactivityTimers.has(vcId)) {
    clearTimeout(musicInactivityTimers.get(vcId));
    musicInactivityTimers.delete(vcId);
  }
}

const distube = new DisTube(client, {
  plugins: [
    new YtDlpPlugin({ update: false }),
  ],
  emitNewSongOnly: false,
  joinNewVoiceChannel: true,
  ffmpeg: {
    path: require('ffmpeg-static'),
  },
});

// ─── DISTUBE EVENTS ──────────────────────────────────────────
distube.on('playSong', (queue, song) => {
  clearInactivityTimer(queue.voiceChannel.id);
  const ch = queue.textChannel;
  if (!ch) return;
  ch.send({ embeds: [new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: '🎵 Now Playing' })
    .setDescription(`**[${song.name}](${song.url})**`)
    .addFields(
      { name: '⏱️ Duration',      value: song.formattedDuration,             inline: true },
      { name: '👤 Requested by',  value: String(song.user),                   inline: true },
      { name: '🔊 Voice Channel', value: `<#${queue.voiceChannel.id}>`,        inline: true }
    )
    .setThumbnail(song.thumbnail || null)
    .setTimestamp()
  ] }).catch(() => {});
});

distube.on('addSong', (queue, song) => {
  resetInactivityTimer(queue);
  const ch = queue.textChannel;
  if (!ch) return;
  ch.send({ embeds: [new EmbedBuilder()
    .setColor(0x2b2d31)
    .setDescription(`<:tick:1487030751550509066> Added **[${song.name}](${song.url})** to the queue for <#${queue.voiceChannel.id}>.`)
    .setTimestamp()
  ] }).catch(() => {});
});

distube.on('addList', (queue, playlist) => {
  resetInactivityTimer(queue);
  const ch = queue.textChannel;
  if (!ch) return;
  ch.send({ embeds: [new EmbedBuilder()
    .setColor(0x2b2d31)
    .setDescription(`<:tick:1487030751550509066> Added playlist **${playlist.name}** (${playlist.songs.length} songs) to the queue for <#${queue.voiceChannel.id}>.`)
    .setTimestamp()
  ] }).catch(() => {});
});

distube.on('finish', queue => {
  resetInactivityTimer(queue);
  const ch = queue.textChannel;
  if (ch) ch.send({ embeds: [new EmbedBuilder()
    .setColor(0x2b2d31)
    .setDescription(`✅ Queue finished for <#${queue.voiceChannel.id}>. Bot will leave in **3 minutes** if no new songs are added.`)
    .setTimestamp()
  ] }).catch(() => {});
});

distube.on('disconnect', queue => {
  clearInactivityTimer(queue.voiceChannel.id);
});

distube.on('error', (channel, error) => {
  console.error('DisTube error:', error);
  if (channel) channel.send({ embeds: [new EmbedBuilder()
    .setColor(0xff3b3b)
    .setDescription(`<:flash:1487027526394974218> Music error: \`${error.message}\``)
    .setTimestamp()
  ] }).catch(() => {});
});



function loadWarns() {
  if (!fs.existsSync(WARNS_FILE)) return {};
  return JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
}

function saveWarns(data) {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2));
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
  const idMatch = arg.match(/^<?@?!?(\d{17,19})>?$/);
  if (!idMatch) return null;
  try { return await guild.members.fetch(idMatch[1]); }
  catch { return null; }
}

const LOG_CHANNEL_ID = '1484500454225477743';

async function sendLog(guild, embed) {
  try {
    const ch = await guild.channels.fetch(LOG_CHANNEL_ID);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (e) { console.error('Log error:', e); }
}

// ─── ANTI-SPAM ───────────────────────────────────────────────
let antiSpamEnabled = false;
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

// ─── HELP PAGES ──────────────────────────────────────────────
// 0 = Overview, 1 = Utility, 2 = Moderation, 3 = Warnings, 4 = Music
const helpPages = [
  (guild) => new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${guild.name} — Command Help`, iconURL: guild.iconURL() })
    .setDescription(
      `Welcome to the help menu! Use the buttons below to browse categories.\n\n` +
      `**Prefix:** \`.\`  •  **Total Commands:** 30\n\n` +
      `> <:user:1487021741720076309> **Utility** — Info, avatar, purge, role & fun\n` +
      `> <:moderator:1487021865682735225> **Moderation** — Ban, kick, mute, unmute & more\n` +
      `> <:warn:1487084599296135311> **Warnings** — Warn, view, clear & remove warns\n` +
      `> 🎵 **Music** — Play, skip, queue, volume & more`
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
      { name: '🏓  `.ping`', value: '> Check if the bot is online.' }
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
      { name: '🛡️  `.as`', value: '> Toggle the anti-spam system on/off. Requires **Administrator**.' }
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
      {
        name: '\u200b',
        value: '**⚡ Auto-Punishment Thresholds**\n> `3 warnings` → Auto-muted for **6 hours**\n> `5 warnings` → Auto-kicked from the server'
      }
    )
    .setFooter({ text: 'Page 4 of 5  •  Warnings' })
    .setTimestamp(),
  (guild) => new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${guild.name} — Music Commands`, iconURL: guild.iconURL() })
    .setDescription(`🎵 Use these commands in <#1487498685800775701> while in a Music VC.\n\u200b`)
    .addFields(
      { name: '▶️  \`.play <song/url>\`',   value: '> Play a song or playlist from YouTube or Spotify. Adds to queue if already playing.' },
      { name: '⏹️  \`.stop\`',              value: '> Stop playback and clear the queue. Bot will leave the VC.' },
      { name: '⏭️  \`.skip\`',              value: '> Skip the current song.' },
      { name: '📋  \`.queue\`',             value: '> Show the current song queue for your VC.' },
      { name: '⏸️  \`.pause\`',             value: '> Pause the current song.' },
      { name: '▶️  \`.resume\`',            value: '> Resume a paused song.' },
      { name: '🔁  \`.loop [off/song/queue]\`', value: '> Toggle loop mode. Options: `off`, `song`, `queue`.' },
      { name: '🔊  \`.volume <1-100>\`',    value: '> Set the playback volume.' },
      { name: '🎵  \`.nowplaying\`  /  \`.np\`', value: '> Show what is currently playing in your VC.' },
      { name: '🔀  \`.shuffle\`',           value: '> Shuffle the current queue.' }
    )
    .setFooter({ text: 'Page 5 of 5  •  Music' })
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
  const { execSync } = require('child_process');
try {
  console.log('ffmpeg path:', execSync('which ffmpeg').toString().trim());
  console.log('ffmpeg version:', execSync('ffmpeg -version').toString().split('\n')[0]);
} catch (e) {
  console.log('ffmpeg not found in PATH:', e.message);
}
  client.user.setPresence({
    status: 'online',
    activities: [{ name: '.gg/wQvb6aqZWZ', type: 4 }]
  });
});

// ─── PREFIX COMMANDS ─────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;

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

  // ─── PING ────────────────────────────────────────────────
  if (command === 'ping') {
    return message.reply('Pong 🏓');
  }

  // ─── HELP ────────────────────────────────────────────────
  if (command === 'help') {
    const sub = args[1]?.toLowerCase();
    // 0=Overview, 1=Utility, 2=Moderation, 3=Warnings, 4=Music
    let page = 0;
    if (sub === 'util' || sub === 'utility')                              page = 1;
    else if (sub === 'mod' || sub === 'moderation')                       page = 2;
    else if (sub === 'warn' || sub === 'warnings' || sub === 'warning')   page = 3;
    else if (sub === 'music' || sub === 'mus')                            page = 4;

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

  // ─── MUSIC HELPERS ───────────────────────────────────────
  function getMusicVC(msg) {
    if (msg.channel.id !== MUSIC_CMD_CHANNEL) return null;
    const vc = msg.member?.voice?.channel;
    if (!vc || !MUSIC_VC_IDS.has(vc.id)) return null;
    return vc;
  }

  // ─── PLAY ────────────────────────────────────────────────
  if (command === 'play' || command === 'p') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) {
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription(`<:flash:1487027526394974218> Music commands only work in <#${MUSIC_CMD_CHANNEL}>.`).setTimestamp()] });
    }
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> **You need to be in a Music VC** to use this command.').setTimestamp()] });
    const query = args.slice(1).join(' ');
    if (!query) return message.reply('Provide a song name or URL. Usage: `.play <song>`');
    try {
      await distube.play(vc, query, { member: message.member, textChannel: message.channel, message });
    } catch (err) {
      console.error(err);
      message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> Could not play that. Try a different name or URL.').setTimestamp()] });
    }
    return;
  }

  // ─── STOP ────────────────────────────────────────────────
  if (command === 'stop') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue) return message.reply('Nothing is playing.');
    clearInactivityTimer(vc.id);
    await queue.stop();
    return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Stopped and cleared the queue.').setTimestamp()] });
  }

  // ─── SKIP ────────────────────────────────────────────────
  if (command === 'skip' || command === 's') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue) return message.reply('Nothing is playing.');
    try {
      await queue.skip();
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Skipped.').setTimestamp()] });
    } catch { return message.reply('No more songs in the queue.'); }
  }

  // ─── QUEUE ───────────────────────────────────────────────
  if (command === 'queue' || command === 'q') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue || queue.songs.length === 0) return message.reply('The queue is empty.');
    const songs = queue.songs.slice(0, 10);
    const list = songs.map((s, i) => (i === 0 ? 'Now: ' : (i + '. ')) + s.name + ' - ' + s.formattedDuration).join('\n');
    const more = queue.songs.length > 10 ? ('\n\n...and ' + (queue.songs.length - 10) + ' more') : '';
    return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setAuthor({ name: 'Queue for ' + vc.name }).setDescription(list + more).setFooter({ text: queue.songs.length + ' song(s) total' }).setTimestamp()] });
  }

  // ─── PAUSE ───────────────────────────────────────────────
  if (command === 'pause') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue) return message.reply('Nothing is playing.');
    if (queue.paused) return message.reply('Already paused. Use `.resume`.');
    queue.pause();
    resetInactivityTimer(queue);
    return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Paused.').setTimestamp()] });
  }

  // ─── RESUME ──────────────────────────────────────────────
  if (command === 'resume') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue) return message.reply('Nothing is playing.');
    if (!queue.paused) return message.reply('Not paused.');
    queue.resume();
    clearInactivityTimer(vc.id);
    return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Resumed.').setTimestamp()] });
  }

  // ─── LOOP ────────────────────────────────────────────────
  if (command === 'loop') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue) return message.reply('Nothing is playing.');
    const mode = args[1]?.toLowerCase();
    let repeatMode;
    if (mode === 'off') repeatMode = 0;
    else if (mode === 'song') repeatMode = 1;
    else if (mode === 'queue') repeatMode = 2;
    else repeatMode = (queue.repeatMode + 1) % 3;
    queue.setRepeatMode(repeatMode);
    const labels = ['Off', 'Song', 'Queue'];
    return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Loop mode set to **' + labels[repeatMode] + '**.').setTimestamp()] });
  }

  // ─── VOLUME ──────────────────────────────────────────────
  if (command === 'volume' || command === 'vol') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue) return message.reply('Nothing is playing.');
    const vol = parseInt(args[1]);
    if (isNaN(vol) || vol < 1 || vol > 100) return message.reply('Provide a volume between 1 and 100.');
    queue.setVolume(vol);
    return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Volume set to **' + vol + '%**.').setTimestamp()] });
  }

  // ─── NOW PLAYING ─────────────────────────────────────────
  if (command === 'nowplaying' || command === 'np') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue || !queue.songs[0]) return message.reply('Nothing is playing.');
    const song = queue.songs[0];
    const elapsed = Math.floor(queue.currentTime);
    const total = song.duration;
    const pct = total > 0 ? Math.floor((elapsed / total) * 20) : 0;
    const bar = '▓'.repeat(pct) + '░'.repeat(20 - pct);
    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: 'Now Playing' })
      .setDescription('[' + song.name + '](' + song.url + ')\n\n' + bar + '\n' + queue.formattedCurrentTime + ' / ' + song.formattedDuration)
      .addFields(
        { name: 'Requested by', value: String(song.user),                        inline: true },
        { name: 'Loop',         value: ['Off','Song','Queue'][queue.repeatMode],  inline: true },
        { name: 'Volume',       value: queue.volume + '%',                        inline: true }
      )
      .setThumbnail(song.thumbnail || null)
      .setTimestamp()
    ] });
  }

  // ─── SHUFFLE ─────────────────────────────────────────────
  if (command === 'shuffle') {
    if (message.channel.id !== MUSIC_CMD_CHANNEL) return;
    const vc = getMusicVC(message);
    if (!vc) return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b).setDescription('<:flash:1487027526394974218> You need to be in a Music VC.').setTimestamp()] });
    const queue = distube.getQueue(message.guild);
    if (!queue || queue.songs.length < 2) return message.reply('Not enough songs in the queue to shuffle.');
    await queue.shuffle();
    return message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('Queue shuffled.').setTimestamp()] });
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

      // customId: help_action_currentPage_invokerId
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

// ─── GUILD MEMBER REMOVE ─────────────────────────────────────
client.on('guildMemberRemove', async member => {
  try {
    try {
      const ban = await member.guild.bans.fetch(member.id);
      if (ban) return;
    } catch {}

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
        .setDescription(
`**Hey ${member.user.username}, we noticed you left.**

Your presence in the server mattered and you'll be missed.`
        )
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
      )
      .setTimestamp());
  } catch {}
});

client.login(process.env.TOKEN);
