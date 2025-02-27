const { MessageEmbed } = require("discord.js");
const dayjs = require("dayjs");

const Incident = require("../models/incident.js");
const { getMember } = require("../utils/functions.js");
const { logChannelID } = require("../utils/config.json");

dayjs.extend(require('dayjs/plugin/utc'));
dayjs.extend(require('dayjs/plugin/timezone'));

module.exports.run = async (client, message, args, color) => {
    if (!message.member.hasPermission("BAN_MEMBERS"))
        return message.channel.send(":no_entry: You dont't have the permission to do that !")
    
    if (!args[1])
        return message.channel.send("Please specify a user");
    
    let tUser = getMember(message, args[1]);
    if (tUser === -1)
        return;
    
    const guildedUser = tUser;
    tUser = tUser.user;

    if (!tUser || tUser == message.author)
        return message.channel.send("Can't find the specified user (already banned?");

    if (guildedUser.hasPermission("ADMINISTRATOR")) return message.channel.send("You can't ban an administrator");

    let reason = args.slice(2).join(" ");
    if (!reason) reason = "No reason specified";

    const promptEmbed = new MessageEmbed()
        .setAuthor(`Are you sure that you want to ban ${tUser.username}?`)
        .setFooter("Automatically canceled after 30 seconds")
        .setColor(color.orange)

    const date = dayjs().tz("Europe/Paris").format('LLL');

    const dmEmbed = new MessageEmbed()
        .setTitle("You have been banned from Duino-Coin!")
        .addField("Reason", reason)
        .addField("Moderator", message.author.username)
        .addField("Date", date)
        .setColor("#ff5c5c")
        .setFooter("The date is UTC+2")
        .setTimestamp()


    const validReactions = ["✅", "❌"];
    const filter = (reaction, user) => validReactions.includes(reaction.emoji.name) && user.id === message.author.id;

    const msg = await message.channel.send(promptEmbed);
    validReactions.forEach(async (r) => await msg.react(r));

    msg.awaitReactions(filter, { time: 30000, max: 1 }).then(async collected => {
        if (!collected.first()) {
            msg.delete();
            return message.delete();
        }

        if (collected.first().emoji.name === "✅") {
            try {
                await tUser.send("https://discord.gg/k48Ht5y", { embed: dmEmbed });
            } catch (e) {
                message.channel.send(`I can't send a DM to ${tUser.username}, but I ban him anyway`);
            }

            try {
                guildedUser.ban({ reason: reason });
            } catch (err) {
                return message.channel.send(`Couldn't ban **${tUser.username}**: ${err}`);
            }
        
            Incident.findOne({
                userID: tUser.id
            }, (err, query) => {
                if (err) console.log(err);
                if (!query) {
                    const newIncident = new Incident({
                        username: tUser.username,
                        userID: tUser.id,
                        reason: reason,
                        type: "Ban",
                        moderator: message.author.username,
                        time: date,
                        count: 1
                    })
        
                    newIncident.save().catch(err => message.channel.send(err));
                } else {
                    query.reason.push(reason);
                    query.moderator.push(message.author.username);
                    query.time.push(date);
                    query.type.push("Ban");
                    query.count += 1;
        
                    query.save().catch(err => message.channel.send(err));
                }
            })
        
            const banEmbed = new MessageEmbed()
                .setTitle("New ban")
                .setDescription(`**${tUser.username}** has been banned!`)
                .addField("Reason", reason)
                .addField("Moderator", message.author.username)
                .addField("Date", date)
                .setColor("#ff5c5c")
                .setFooter("The date is UTC+2")
                .setTimestamp()
            
            message.channel.send(banEmbed);
            client.channels.cache.get(logChannelID).send(banEmbed);
            msg.delete();
            message.delete();
        } else if (collected.first().emoji.name === "❌") {
            promptEmbed.setAuthor(`Ban cancelled`)
                       .setFooter("Automatically cancelled after 30 seconds")
                       .setColor(color.orange)

            msg.edit(promptEmbed);
        }
    })
}


module.exports.config = {
    name: "ban",
    aliases: [],
    usage: "<user> <reason>",
    category: "moderation",
    desc: "Ban the user"
}
