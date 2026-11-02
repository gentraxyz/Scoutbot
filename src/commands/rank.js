const { AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const { cardFor } = require('../levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription("Show your level card, or someone else's")
    .addUserOption((option) => option.setName('user').setDescription('Member to look up')),

  guildOnly: true,

  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    await interaction.deferReply();
    const png = await cardFor(target, interaction.guild.id);
    return interaction.editReply({ files: [new AttachmentBuilder(png, { name: 'rank.png' })] });
  },
};
