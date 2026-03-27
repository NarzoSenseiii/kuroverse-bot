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

const LOG_CHANNEL_ID = '1484500454225477743';

async function sendLog(guild, embed) {
  try {
    const ch = await guild.channels.fetch(LOG_CHANNEL_ID);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (e) { console.error('Log error:', e); }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 🔹 PREFIX COMMANDS
client.on('messageCreate', async message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");

      const member = await message.guild.members.fetch(user.id);

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

      let dmStatus = "No";
      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff3b3b)
            .setDescription(
`<:flash:1487027526394974218> **You have been muted**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:duration:1487022019273953300> Duration: ${timeArg}  
<:reason:1487022066644291614> Reason: ${reason}`
            )
            .setTimestamp()]
        });
        dmStatus = "Yes";
      } catch (e) { dmStatus = "No"; }

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0xff3b3b).setTitle('🔇 Member Muted')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Duration', value: timeArg, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been muted`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:duration:1487022019273953300> Duration", value: timeArg, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason },
          { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true }
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

    } catch (err) {
      console.error(err);
      message.reply("Error muting user.");
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

      let dmStatus = "No";
      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(
`<:tick:1487030751550509066> **You have been unbanned**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:reason:1487022066644291614> Reason: ${reason}

${invite ? `🔗 **Rejoin:** ${invite.url}` : ""}`
            )
            .setTimestamp()]
        });
        dmStatus = "Yes";
      } catch (e) { dmStatus = "No"; }

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0x57F287).setTitle('✅ Member Unbanned')
        .addFields(
          { name: 'User', value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${user.tag} has been unbanned`, iconURL: user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
          { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true },
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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");

      const member = await message.guild.members.fetch(user.id);

      await member.timeout(null);

      let dmStatus = "No";
      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(
`<:tick:1487030751550509066> **You have been unmuted**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>`
            )
            .setTimestamp()]
        });
        dmStatus = "Yes";
      } catch (e) { dmStatus = "No"; }

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0x57F287).setTitle('🔊 Member Unmuted')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true }
        ).setTimestamp());

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been unmuted`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true }
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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");

      const member = await message.guild.members.fetch(user.id);
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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");

      const member = await message.guild.members.fetch(user.id);
      const reason = args.slice(2).join(" ") || "No reason provided";

      await member.ban({ reason });

      let dmStatus = "No";
      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff3b3b)
            .setDescription(
`<:flash:1487027526394974218> **You have been banned**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:reason:1487022066644291614> Reason: ${reason}`
            )
            .setTimestamp()]
        });
        dmStatus = "Yes";
      } catch (e) { dmStatus = "No"; }

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0xff3b3b).setTitle('🔨 Member Banned')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been banned`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
          { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true },
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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");

      const member = await message.guild.members.fetch(user.id);
      const reason = args.slice(2).join(" ") || "No reason provided";

      await member.kick();

      let dmStatus = "No";
      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff3b3b)
            .setDescription(
`<:flash:1487027526394974218> **You have been kicked**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>  
<:reason:1487022066644291614> Reason: ${reason}`
            )
            .setTimestamp()]
        });
        dmStatus = "Yes";
      } catch (e) { dmStatus = "No"; }

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0xFFA500).setTitle('👟 Member Kicked')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been kicked`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
          { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>` }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });

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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");
      const member = await message.guild.members.fetch(user.id);
      const reason = args.slice(2).join(" ") || "No reason provided";

      const warns = loadWarns();
      const key = `${message.guild.id}_${user.id}`;
      if (!warns[key]) warns[key] = [];
      warns[key].push({ reason, by: invokerId, at: Date.now() });
      saveWarns(warns);

      const count = warns[key].length;

      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0xFFA500)
            .setDescription(
`<:warn:1487084599296135311> **You have been warned**

**Server:** **${message.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${invokerId}>
<:reason:1487022066644291614> Reason: ${reason}
<:warn:1487084599296135311> Total Warnings: **${count}**`
            ).setTimestamp()]
        });
      } catch {}

      // auto punishments
      if (count === 3) {
        await member.timeout(6 * 60 * 60 * 1000);
        await sendLog(message.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('<:muteee:1487085617119756358> Auto-Muted (3 Warnings)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Duration', value: '6 hours', inline: true }
          ).setTimestamp());
        try {
          await user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b)
            .setDescription(`<:muteee:1487085617119756358> **You have been auto-muted for 6 hours** in **${message.guild.name}** for reaching 3 warnings.`).setTimestamp()] });
        } catch {}
      }

      if (count === 5) {
        try {
          await user.send({ embeds: [new EmbedBuilder().setColor(0xff3b3b)
            .setDescription(`<:flashwarn:1487025332841091182> **You have been auto-kicked** from **${message.guild.name}** for reaching 5 warnings.`).setTimestamp()] });
        } catch {}
        await member.kick("5 warnings reached");
        await sendLog(message.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('<:flashwarn:1487025332841091182> Auto-Kicked (5 Warnings)')
          .addFields({ name: 'User', value: `<@${member.id}>`, inline: true }).setTimestamp());
      }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: `${member.user.tag} has been warned`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
          { name: "<:moderator:1487021865682735225> Moderator", value: `<@${invokerId}>`, inline: true },
          { name: "<:warn:1487084599296135311> Warnings", value: `${count}`, inline: true },
          { name: "<:reason:1487022066644291614> Reason", value: reason }
        ).setTimestamp();

      await sendLog(message.guild, new EmbedBuilder()
        .setColor(0xFFA500).setTitle('<:warn:1487084599296135311> Member Warned')
        .addFields(
          { name: 'User', value: `<@${member.id}>`, inline: true },
          { name: 'Moderator', value: `<@${invokerId}>`, inline: true },
          { name: 'Warnings', value: `${count}`, inline: true },
          { name: 'Reason', value: reason }
        ).setTimestamp());

      message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(makeDeleteBtn(invokerId))] });
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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");
      const member = await message.guild.members.fetch(user.id);

      const warns = loadWarns();
      const key = `${message.guild.id}_${user.id}`;
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

      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user.");
      const member = await message.guild.members.fetch(user.id);

      const warns = loadWarns();
      const key = `${message.guild.id}_${user.id}`;
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
      const target = message.mentions.users.first() || message.author;
      const member = await message.guild.members.fetch(target.id);

      const warns = loadWarns();
      const key = `${message.guild.id}_${target.id}`;
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
});

// ─────────────────────────────────────────────────────────────
// 🔹 BUTTON & MODAL INTERACTIONS
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

        let dmStatus = "No";
        try {
          await member.user.send({
            embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription(
`<:tick:1487030751550509066> **You have been unmuted**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>`
              )
              .setTimestamp()]
          });
          dmStatus = "Yes";
        } catch { dmStatus = "No"; }

        await sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0x57F287).setTitle('🔊 Member Unmuted (via button)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
          ).setTimestamp());

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${member.user.tag} has been unmuted`, iconURL: member.user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>`, inline: true },
            { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

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

        let dmStatus = "No";
        try {
          await member.user.send({
            embeds: [new EmbedBuilder()
              .setColor(0xff3b3b)
              .setDescription(
`<:flash:1487027526394974218> **You have been muted**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>  
<:duration:1487022019273953300> Duration: ${timeArg}  
<:reason:1487022066644291614> Reason: ${reason}`
              )
              .setTimestamp()]
          });
          dmStatus = "Yes";
        } catch { dmStatus = "No"; }

        await sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('🔇 Member Muted (via button)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Duration', value: timeArg, inline: true },
            { name: 'Reason', value: reason }
          ).setTimestamp());

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${member.user.tag} has been muted`, iconURL: member.user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>`, inline: true },
            { name: "<:duration:1487022019273953300> Duration", value: timeArg, inline: true },
            { name: "<:reason:1487022066644291614> Reason", value: reason },
            { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

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

        let dmStatus = "No";
        try {
          await user.send({
            embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription(
`<:tick:1487030751550509066> **You have been unbanned**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>  
<:reason:1487022066644291614> Reason: ${reason}

${invite ? `🔗 **Rejoin:** ${invite.url}` : ""}`
              )
              .setTimestamp()]
          });
          dmStatus = "Yes";
        } catch { dmStatus = "No"; }

        await sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0x57F287).setTitle('✅ Member Unbanned (via button)')
          .addFields(
            { name: 'User', value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason }
          ).setTimestamp());

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${user.tag} has been unbanned`, iconURL: user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `[${user.tag}](https://discord.com/users/${user.id})`, inline: true },
            { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
            { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>` }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

      } catch (err) { console.error(err); }
    }

    // BAN MODAL
    if (customId.startsWith('ban_modal_')) {
      try {
        const member = await interaction.guild.members.fetch(targetId);

        await member.ban({ reason });

        let dmStatus = "No";
        try {
          await member.user.send({
            embeds: [new EmbedBuilder()
              .setColor(0xff3b3b)
              .setDescription(
`<:flash:1487027526394974218> **You have been banned**

**Server:** **${interaction.guild.name}**

<:moderator:1487021865682735225> Moderator: <@${interaction.user.id}>  
<:reason:1487022066644291614> Reason: ${reason}`
              )
              .setTimestamp()]
          });
          dmStatus = "Yes";
        } catch { dmStatus = "No"; }

        await sendLog(interaction.guild, new EmbedBuilder()
          .setColor(0xff3b3b).setTitle('🔨 Member Banned (via button)')
          .addFields(
            { name: 'User', value: `<@${member.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason }
          ).setTimestamp());

        const updatedEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: `${member.user.tag} has been banned`, iconURL: member.user.displayAvatarURL() })
          .addFields(
            { name: "<:user:1487021741720076309> User", value: `<@${member.id}>`, inline: true },
            { name: "<:reason:1487022066644291614> Reason", value: reason, inline: true },
            { name: "<:dm:1487024757239971913> DM Sent", value: dmStatus, inline: true },
            { name: "<:moderator:1487021865682735225> Moderator", value: `<@${interaction.user.id}>` }
          )
          .setTimestamp();

        const deleteRow = new ActionRowBuilder().addComponents(makeDeleteBtn(embeddedInvokerId));
        await interaction.message.edit({ embeds: [updatedEmbed], components: [deleteRow] });

      } catch (err) { console.error(err); }
    }
  }
});

client.login(process.env.TOKEN);