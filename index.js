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
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = ".";
const fs = require('fs');
const WARNS_FILE = './warnings.json';
const afkMap = new Map(); // userId -> { reason, since }

function loadWarns() {
  if (!fs.existsSync(WARNS_FILE)) return {};
  return JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
}

function saveWarns(data) {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2));
}

// 🧠 Time parser
function parseTime(time) {
  const num = parseInt(time);
  if (time.endsWith('s')) return num * 1000;
  if (time.endsWith('m')) return num * 60 * 1000;
  if (time.endsWith('h')) return num * 60 * 60 * 1000;
  if (time.endsWith('d')) return num * 24 * 60 * 60 * 1000;
  return null;
}

// 🗑️ Delete button
function makeDeleteBtn(invokerId) {
  return new ButtonBuilder()
    .setCustomId(`delete_msg_${invokerId}`)
    .setEmoji({ id: '1487069391987409010', name: 'delete' })
    .setStyle(ButtonStyle.Secondary);
}

// 🚫 No permissions embed
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

// 🔺 Role hierarchy check embed
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

// 🔍 Resolve member by mention or raw ID
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

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: 'online',
    activities: [{
      name: '.gg/wQvb6aqZWZ',
      type: 4
    }]
  });
});

// 🔹 PREFIX COMMANDS
client.on('messageCreate', async message => {
  if (message.author.bot) return;
    handleAntiSpam(message);

  // ——— AFK: remove AFK if person types ———
  if (afkMap.has(message.author.id) && !message.content.startsWith(prefix)) {
    const data = afkMap.get(message.author.id);
    const pings = data.pings || 0;
    afkMap.delete(message.author.id);
    message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`<:tick:1487030751550509066> Welcome back <@${message.author.id}>! Your AFK has been removed.${pings > 0 ? `\n<:book_move:1484604157221540020> You got **${pings}** ping${pings === 1 ? '' : 's'} while you were away.` : ''}`)
      .setTimestamp()] }).catch(() => {});
  }

  // ——— AFK: notify if someone pings an AFK user ———
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

  // PING
  if (command === 'ping') {
    return message.reply('Pong 🏓');
  }

  // MUTE
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
      let reason;
      let ms;

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
        new ButtonBuilder()
          .setCustomId(`unmute_btn_${member.id}_${invokerId}`)
          .setLabel('Unmute')
          .setStyle(ButtonStyle.Success),
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

    } catch (err) {
      console.error(err);
      message.reply("Error muting user.");
    }
  }
  // CHOOSE
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

    } catch (err) {
      console.error(err);
      message.reply("Error choosing.");
    }
  }
  // LOCK
  if (command === 'lock') {
    try {
      if (!message.member.permissions.has('ManageChannels')) {
        return message.channel.send({
          embeds: [noPermsEmbed('lock channels for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });

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

    } catch (err) {
      console.error(err);
      message.reply("Error locking channel.");
    }
  }
// 🛡️ ANTI-SPAM SYSTEM
let antiSpamEnabled = false;
const spamMap = new Map();    // userId -> { messages: [], muteLevel: 0, lastMuteEnd: 0 }
const OWNER_ID = '1212375999132467270';
const SPAM_LIMIT = 5;
const SPAM_WINDOW = 5000;     // 5 seconds
const COOLDOWN = 60000;       // 1 minute after mute before escalation resets window

async function handleAntiSpam(message) {
  if (!antiSpamEnabled) return;
  if (message.author.bot) return;
  if (message.member?.permissions.has('Administrator')) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!spamMap.has(userId)) spamMap.set(userId, { messages: [], muteLevel: 0, lastMuteEnd: 0 });
  const data = spamMap.get(userId);

  // reset escalation if enough time has passed since last mute ended
  if (data.lastMuteEnd && now - data.lastMuteEnd > 60000) {
    data.muteLevel = 0;
  }

  data.messages.push({ id: message.id, time: now });
  data.messages = data.messages.filter(m => now - m.time < SPAM_WINDOW);

  if (data.messages.length < SPAM_LIMIT) return;

  // spamming detected
  const msgIds = data.messages.map(m => m.id);
  data.messages = [];

  let muteDuration;
  let deleteAll = false;
  let label;

  switch (data.muteLevel) {
    case 0: muteDuration = 60000;          label = '1 minute';   deleteAll = false; break;
    case 1: muteDuration = 600000;         label = '10 minutes'; deleteAll = true;  break;
    case 2: muteDuration = 3600000;        label = '1 hour';     deleteAll = true;  break;
    case 3: muteDuration = 43200000;       label = '12 hours';   deleteAll = true;  break;
    default: muteDuration = 43200000;      label = '12 hours';   deleteAll = true;  break;
  }

  data.muteLevel = Math.min(data.muteLevel + 1, 4);
  data.lastMuteEnd = now + muteDuration;

  // delete messages
  try {
    const toDelete = deleteAll ? msgIds : msgIds.slice(1);
    await message.channel.bulkDelete(toDelete, true).catch(() => {});
  } catch {}

  // mute
  try { await message.member.timeout(muteDuration); } catch {}

  // DM user
  message.author.send({ embeds: [new EmbedBuilder()
    .setColor(0xff3b3b)
    .setDescription(
`<:flash:1487027526394974218> **You have been muted for spamming**

**Server:** **${message.guild.name}**

<:duration:1487022019273953300> Duration: ${label}
<:reason:1487022066644291614> Reason: Anti-spam — sending too many messages too fast.`
    ).setTimestamp()] }).catch(() => {});

  // channel embed
  message.channel.send({ embeds: [new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `${message.author.tag} has been muted`, iconURL: message.author.displayAvatarURL() })
    .addFields(
      { name: "<:user:1487021741720076309> User", value: `<@${userId}>`, inline: true },
      { name: "<:duration:1487022019273953300> Duration", value: label, inline: true },
      { name: "<:reason:1487022066644291614> Reason", value: 'Anti-spam triggered.' }
    ).setTimestamp()] }).catch(() => {});

  // log
  sendLog(message.guild, new EmbedBuilder()
    .setColor(0xff3b3b).setTitle('🛡️ Anti-Spam Mute')
    .addFields(
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Duration', value: label, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Escalation Level', value: `${data.muteLevel}`, inline: true }
    ).setTimestamp());

  // DM owner if 12hr mute
  if (muteDuration === 43200000) {
    const owner = await client.users.fetch(OWNER_ID).catch(() => null);
    if (owner) {
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
        ).setTimestamp()] }).catch(() => {});
    }
  }
}
  // UNLOCK
  if (command === 'unlock') {
    try {
      if (!message.member.permissions.has('ManageChannels')) {
        return message.channel.send({
          embeds: [noPermsEmbed('unlock channels for')],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });

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

    } catch (err) {
      console.error(err);
      message.reply("Error unlocking channel.");
    }
  }
  // USERINFO
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
      const roles = target.roles.cache
        .filter(r => r.id !== message.guild.id)
        .sort((a, b) => b.position - a.position);
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
          {
            name: "📋 Basic Info",
            value: `**ID:** ${user.id}\n**Username:** ${user.username}\n**Display Name:** ${target.displayName}\n**Bot:** ${user.bot ? 'True' : 'False'}`
          },
          {
            name: "📅 Timestamps",
            value: `**Joined:** <t:${joinedAt}:R> • <t:${joinedAt}:f>\n**Created:** <t:${createdAt}:R> • <t:${createdAt}:f>`
          },
          {
            name: "⚡ Boosting",
            value: isBoosting ? 'Yes' : 'No',
            inline: true
          },
          {
            name: "<:warn:1487084599296135311> Warnings",
            value: `${warnCount}`,
            inline: true
          },
          {
            name: `🎭 Roles [${roles.size}]`,
            value: roles.size > 0 ? roles.map(r => `<@&${r.id}>`).join(', ') : 'None'
          },
          {
            name: "🏆 Top Role",
            value: topRole ? `<@&${topRole.id}>` : 'None'
          }
        )
        .setFooter({ text: `Requested by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

    } catch (err) {
      console.error(err);
      message.reply("Error fetching user info.");
    }
  }
  // MEMBERCOUNT
  if (command === 'membercount' || command === 'mc') {
    try {
      const guild = message.guild;
      await guild.fetch();

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .addFields(
          { name: "<:user:1487021741720076309> Total Members", value: `${guild.memberCount}`, inline: true }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

    } catch (err) {
      console.error(err);
      message.reply("Error fetching member count.");
    }
  }
  // SERVERINFO
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
          {
            name: "📋 General Info",
            value: `**Name:** ${guild.name}\n**Server ID:** ${guild.id}\n**Owner:** <@${owner.id}>\n**Created:** <t:${createdAt}:R> • <t:${createdAt}:f>`
          },
          {
            name: "👥 Members & Roles",
            value: `**Members:** ${guild.memberCount}\n**Roles:** ${guild.roles.cache.size}\n**Verification Level:** ${guild.verificationLevel.toString().toLowerCase()}`,
            inline: true
          },
          {
            name: "💎 Boost Status",
            value: `**Level:** ${guild.premiumTier}\n**Boosts:** ${guild.premiumSubscriptionCount}`,
            inline: true
          },
          {
            name: "📁 Channels",
            value: `**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Categories:** ${categories}`
          }
        )
        .setFooter({ text: `Requested by ${message.member.displayName}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

    } catch (err) {
      console.error(err);
      message.reply("Error fetching server info.");
    }
  }
  // AVATAR
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

    } catch (err) {
      console.error(err);
      message.reply("Error fetching avatar.");
    }
  }
// PURGE
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

    } catch (err) {
      console.error(err);
      message.reply("Error purging messages. Messages older than 14 days can't be bulk deleted.");
    }
  }
  // UNBAN
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
      try {
        user = await client.users.fetch(userId);
      } catch {
        return message.reply("Invalid user ID.");
      }

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
        new ButtonBuilder()
          .setCustomId(`ban_btn_${user.id}_${invokerId}`)
          .setLabel('Ban')
          .setStyle(ButtonStyle.Danger),
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

    } catch (err) {
      console.error(err);
      message.reply("Error unbanning user.");
    }
  }

  // UNMUTE
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
        new ButtonBuilder()
          .setCustomId(`mute_btn_${member.id}_${invokerId}`)
          .setLabel('Mute')
          .setStyle(ButtonStyle.Danger),
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

    } catch (err) {
      console.error(err);
      message.reply("Error unmuting user.");
    }
  }

  // NICK
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

    } catch (err) {
      console.error(err);
      message.reply("Error changing nickname. Make sure I have permission.");
    }
  }

  // BAN
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
        new ButtonBuilder()
          .setCustomId(`unban_btn_${member.id}_${invokerId}`)
          .setLabel('Unban')
          .setStyle(ButtonStyle.Success),
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

    } catch (err) {
      console.error(err);
      message.reply("Error banning user.");
    }
  }

  // KICK
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

    } catch (err) {
      console.error(err);
      message.reply("Error kicking user.");
    }
  }

  // WARN
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

      // auto punishments
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

  // CLEARWARNS
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

  // REMOVEWARN
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

  // WARNS (self-check, usable by everyone)
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

  // ROLE
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
            .setDescription(
              `<:flash:1487027526394974218> **I cannot assign the role ${role.name}.**\n\n` +
              `That role is equal to or higher than my highest role.`
            )
            .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))]
        });
      }

      const hasRole = member.roles.cache.has(role.id);
      if (hasRole) {
        await member.roles.remove(role);
      } else {
        await member.roles.add(role);
      }

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

    } catch (err) {
      console.error(err);
      message.reply("Error assigning role.");
    }
  }

  // AFK
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

});
// ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  // ——— BUTTONS ———
  if (interaction.isButton()) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const embeddedInvokerId = parts[parts.length - 1];

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

    // DELETE BUTTON
    if (customId.startsWith('delete_msg_')) {
      return interaction.message.delete();
    }

    // UNMUTE BUTTON
    if (customId.startsWith('unmute_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder()
        .setCustomId(`unmute_modal_${targetId}_${embeddedInvokerId}`)
        .setTitle('Unmute Reason');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for Unmuting')
        .setPlaceholder('Provide a reason to unmute or leave it blank.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }

    // MUTE BUTTON
    if (customId.startsWith('mute_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder()
        .setCustomId(`mute_modal_${targetId}_${embeddedInvokerId}`)
        .setTitle('Mute Reason');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for Muting')
        .setPlaceholder('Provide a reason to mute or leave it blank.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Duration (e.g. 10m, 1h, 1d)')
        .setPlaceholder('Leave blank for 24h default')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(durationInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      return interaction.showModal(modal);
    }

    // UNBAN BUTTON
    if (customId.startsWith('unban_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder()
        .setCustomId(`unban_modal_${targetId}_${embeddedInvokerId}`)
        .setTitle('Unban Reason');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for Unbanning')
        .setPlaceholder('Provide a reason to unban or leave it blank.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }

    // BAN BUTTON
    if (customId.startsWith('ban_btn_')) {
      const targetId = parts[2];
      const modal = new ModalBuilder()
        .setCustomId(`ban_modal_${targetId}_${embeddedInvokerId}`)
        .setTitle('Ban Reason');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for Banning')
        .setPlaceholder('Provide a reason to ban or leave it blank.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

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

    // UNMUTE MODAL
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

    // MUTE MODAL
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

    // UNBAN MODAL
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

    // BAN MODAL
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
client.on('guildMemberRemove', async member => {
  try {
    // skip if banned
try {
  const ban = await member.guild.bans.fetch(member.id);
  if (ban) return;
} catch {}

// skip if recently kicked
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
