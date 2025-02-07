import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, User, Role, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default class Pass extends BotInteraction {
    get name() {
        return 'assign';
    }

    get description() {
        return 'Assigns a role to a user';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get slashData() {
        const RoleOptions: any = [];
        Object.keys(this.client.util.utilities.assignOptions).forEach((key: string) => {
            RoleOptions.push({ name: key, value: this.client.util.utilities.assignOptions[key] })
        })
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption((option) => option.setName('role').setDescription('Role').addChoices(
                ...RoleOptions
            ).setRequired(true))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const userResponse: User = interaction.options.getUser('user', true);
        const role: string = interaction.options.getString('role', true);

        const { stripRole, categorizeChannel, categorize } = this.client.util.utilities.functions;
        // const { Categories } = this.client.util.utilities.enums;
        const { roles, colours, rolePrereqisites, removeHeirarchy, channels, heirarchy } = this.client.util.utilities;

        const channel = await this.client.channels.fetch(channels[categorizeChannel(role)]) as TextChannel;

        const user = await interaction.guild?.members.fetch(userResponse.id);
        const userRoles = user?.roles.cache.map(role => role.id) || [];

        let sendMessage = false;
        let anyAdditionalRole;
        const roleObject = await interaction.guild?.roles.fetch(stripRole(roles[role])) as Role;
        let embedColour = colours.discord.green;


        const hasHigherRole = (role: string) => {
            if (!categorize(role)) return false;
            const categorizedHeirarchy = heirarchy[categorize(role)];
            const sliceFromIndex: number = categorizedHeirarchy.indexOf(role) + 1;
            const heirarchyList = categorizedHeirarchy.slice(sliceFromIndex);
            const heirarchyIdList = heirarchyList.map((item: string) => stripRole(roles[item]));
            const intersection = heirarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
            if (intersection.length === 0) {
                return false
            } else {
                return true
            };
        }

        console.log(hasHigherRole(role))
        // Check for pre-requisite
        if (role in rolePrereqisites) {
            // For each key inside a role pre-requisite
            for (const key in rolePrereqisites[role]) {
                // Break out if they have the role already or if they have any higher role
                if (userRoles?.includes(stripRole(roles[key])) && hasHigherRole(role)) {
                    break;
                };
                let assign = true;
                // Loop over each role and check if they have all pre-requisites
                rolePrereqisites[role][key].forEach((prereqRole: string) => {
                    const roleId = stripRole(roles[prereqRole]);
                    if (!(userRoles?.includes(roleId))) {
                        assign = false;
                    }
                })
                // Assign the additional role and remove the existing pre-requisite roles
                if (assign) {
                    const assignedRoleId = stripRole(roles[key]);
                    if (!(userRoles?.includes(assignedRoleId)) && !hasHigherRole(role)) {
                        sendMessage = true;
                    }
                    if (!hasHigherRole(role)) await user?.roles.add(assignedRoleId);
                    embedColour = roleObject.color;
                    rolePrereqisites[role][key].forEach((prereqRole: string) => {
                        const roleId = stripRole(roles[prereqRole]);
                        user?.roles.remove(roleId);
                    })
                    // Remove inferior roles for combination roles
                    if ((key in removeHeirarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of removeHeirarchy[key]) {
                            const removeRoleId = stripRole(roles[roleToRemove]);
                            await user?.roles.remove(removeRoleId);
                        };
                    }
                    if ((role in removeHeirarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of removeHeirarchy[role]) {
                            const removeRoleId = stripRole(roles[roleToRemove]);
                            await user?.roles.remove(removeRoleId);
                        };
                    }
                    anyAdditionalRole = key;
                    // Just add the new role as no pre-requisites for the combined role
                } else {
                    const roleId = stripRole(roles[role]);
                    if (!hasHigherRole(role)) user?.roles.add(roleId);
                    embedColour = roleObject.color;
                    if (!(userRoles?.includes(roleId)) && !hasHigherRole(role)) {
                        sendMessage = true;
                    }
                    // Remove inferior roles
                    if ((role in removeHeirarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of removeHeirarchy[role]) {
                            const removeRoleId = stripRole(roles[roleToRemove]);
                            await user?.roles.remove(removeRoleId);
                        };
                    }
                }
            }
            // No pre-requisite needed so just assign role
        } else {
            const roleId = stripRole(roles[role]);
            if (!hasHigherRole(role)) await user?.roles.add(roleId);
            embedColour = roleObject.color;
            if (!(userRoles?.includes(roleId)) && !hasHigherRole(role)) {
                sendMessage = true;
            }
            if (role in removeHeirarchy) {
                for await (const roleToRemove of removeHeirarchy[role]) {
                    const removeRoleId = stripRole(roles[roleToRemove]);
                    await user?.roles.remove(removeRoleId);
                };
            }
        }

        let returnedMessage = {
            id: '',
            url: ''
        };
        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || '' })
            .setTimestamp()
            .setColor(embedColour)
            .setDescription(`
            Congratulations to <@${userResponse.id}> on achieving ${roles[role]}!
            ${anyAdditionalRole ? `By achieving this role, they are also awarded ${roles[anyAdditionalRole]}!` : ''}
            `);
        if (sendMessage) await channel.send({ embeds: [embed] }).then(message => {
            returnedMessage.id = message.id;
            returnedMessage.url = message.url;
        });

        const logChannel = await this.client.channels.fetch(channels.botRoleLog) as TextChannel;
        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rejectRoleAssign')
                    .setLabel('Reject Approval')
                    .setStyle(ButtonStyle.Danger),
            );
        const logEmbed = new EmbedBuilder()
            .setTimestamp()
            .setColor(embedColour)
            .setDescription(`
            ${roles[role]} was assigned to <@${userResponse.id}> by <@${interaction.user.id}>.
            ${anyAdditionalRole ? `${roles[anyAdditionalRole]} was also assigned.\n` : ''}
            **Message**: [${returnedMessage.id}](${returnedMessage.url})
            `);
        if (sendMessage) await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });

        const replyEmbed = new EmbedBuilder()
            .setTitle(sendMessage ? 'Role successfully assigned!' : 'Role assign failed.')
            .setColor(sendMessage ? colours.discord.green : colours.discord.red)
            .setDescription(sendMessage ? `
            **Member:** <@${userResponse.id}>
            **Role:** ${roles[role]}
            ${anyAdditionalRole ? `**Additional Roles:** ${roles[anyAdditionalRole]}` : ''}
            ` : `This user either has this role, or a higher level role.`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}