const { ChannelType, EmbedBuilder, SlashCommandBuilder, time, TimestampStyles } = require('discord.js');
const { fetchMember, formatDuration, makeEmbed } = require('../utils');

const ping = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true });
    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
    return interaction.editReply({
      content: `🏓 Pong! Round trip **${roundTrip}ms**, WebSocket **${interaction.client.ws.ping}ms**.`,
    });
  },
};

const avatar = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show a user's avatar")
    .addUserOption((option) => option.setName('user').setDescription('Defaults to you')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const url = user.displayAvatarURL({ size: 1024 });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${user.username}'s avatar`)
      .setImage(url)
      .setDescription(`[Open original](${url})`);
    return interaction.reply({ embeds: [embed] });
  },
};

const userinfo = {
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show information about a member')
    .addUserOption((option) => option.setName('user').setDescription('Defaults to you')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = await fetchMember(interaction.guild, user.id);
    const avatarUrl = user.displayAvatarURL({ size: 256 });
    const roles = member?.roles.cache
      .filter((role) => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => role.toString());

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865f2)
      .setTitle(user.tag ?? user.username)
      .setThumbnail(avatarUrl)
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account created', value: time(user.createdAt, TimestampStyles.LongDate), inline: false },
      );

    if (member) {
      embed.addFields(
        { name: 'Joined server', value: time(member.joinedAt, TimestampStyles.LongDate), inline: false },
        { name: 'Nickname', value: member.nickname ?? 'None', inline: true },
        {
          name: `Roles (${roles.length})`,
          value: roles.length ? truncateField(roles.join(' ')) : 'None',
          inline: false,
        },
      );
      if (member.isCommunicationDisabled()) {
        embed.addFields({ name: 'Timed out until', value: time(member.communicationDisabledUntil, TimestampStyles.RelativeTime) });
      }
    } else {
      embed.setFooter({ text: 'Not a member of this server' });
    }

    return interaction.reply({ embeds: [embed] });
  },
};

const serverinfo = {
  guildOnly: true,
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show information about this server'),

  async execute(interaction) {
    const { guild } = interaction;
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;
    const text = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voice = channels.filter((c) => c.type === ChannelType.GuildVoice).size;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .addFields(
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
        { name: 'Members', value: String(guild.memberCount), inline: true },
        { name: 'Channels', value: `${text} text, ${voice} voice`, inline: true },
        { name: 'Roles', value: String(guild.roles.cache.size - 1), inline: true },
        { name: 'Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`, inline: true },
        { name: 'Created', value: time(guild.createdAt, TimestampStyles.LongDate), inline: false },
      );
    const icon = guild.iconURL({ size: 256 });
    if (icon) embed.setThumbnail(icon);
    const banner = guild.bannerURL({ size: 1024 });
    if (banner) embed.setImage(banner);

    return interaction.reply({ embeds: [embed] });
  },
};

function truncateField(text) {
  return text.length > 1000 ? `${text.slice(0, 997)}…` : text;
}

module.exports = { ping, avatar, userinfo, serverinfo };
