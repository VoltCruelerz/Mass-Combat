/* Mass Combat
*
* A companion script for Kyburn's Mass Combat rule set: 
* https://docs.google.com/document/d/1-56AC-p57x-vr_BzszksjC55kTFK4d67XOzcIb1pWCY/edit?usp=sharing
*
* by Michael Greene (Volt Cruelerz)
*
*/

on('ready', () => {
    const mcname = 'MassCombat';
    const v = 0.2;

    const getCharByAny = (nameOrId) => {
        let character = null;
      
        // Try to directly load the character ID
        character = getObj('character', nameOrId);
        if (character) {
            return character;
        }
      
        // Try to load indirectly from the token ID
        const token = getObj('graphic', nameOrId);
        if (token) {
            character = getObj('character', token.get('represents'));
            if (character) {
                return character;
            }
        }
      
        // Try loading through char name
        const list = findObjs({
            _type: 'character',
            name: nameOrId,
        });
        if (list.length === 1) {
            return list[0];
        }
      
        // Default to null
        return null;
    };

    const getAttrs = (char, attrName) => {
        const attr = filterObjs((obj) => {
            if (obj.get('type') === 'attribute'
                && obj.get('characterid') === char.id
                && obj.get('name') == attrName) {
                    //log('Valid Obj: ' + JSON.stringify(obj));
                    return obj;
            }
        });
        if (!attr || attr.length === 0) {
            log('No Attr');
            return null;
        }
        return attr;
    }

    const getAttr = (char, attrName) => {
        return getAttrs(char, attrName)[0];
    }

    const getAttrsFromSub = (char, substringName) => {
        const attr = filterObjs((obj) => {
            if (obj.get('type') === 'attribute'
                && obj.get('characterid') === char.id
                && obj.get('name').indexOf(substringName) !== -1) {
                    //log('Valid Obj: ' + JSON.stringify(obj));
                    return obj;
            }
        });
        if (!attr || attr.length === 0) {
            log('No Attr');
            return null;
        }
        return attr;
    }

    const getAttrFromSub = (char, substringName) => {
        return getAttrsFromSub(char, substringName)[0];
    }

    const sizeCostArray = [0.01, 0.03, 0.1, 0.3, 1.0, 3.0];
    const creatureSize = {
        "Tiny": 0,
        "Small": 1,
        "Medium": 2,
        "Large": 3,
        "Huge": 4,
        "Gargantuan": 5
    };

    const getCreatureSize = (npcType) => {
        if (npcType.toLowerCase().includes('tiny')) {
            return creatureSize.Tiny;
        } else if (npcType.toLowerCase().includes('small')) {
            return creatureSize.Medium;
        } else if (npcType.toLowerCase().includes('medium')) {
            return creatureSize.Medium;
        } else if (npcType.toLowerCase().includes('large')) {
            return creatureSize.Large;
        } else if (npcType.toLowerCase().includes('huge')) {
            return creatureSize.Huge;
        } else if (npcType.toLowerCase().includes('gargantuan')) {
            return creatureSize.Gargantuan;
        } else {
            return -1;
        }
    };

    class Hero {
        constructor(name, hp, mhp) {
            this.Name = name;
            this.HP = hp;
            this.MHP = mhp;
        }
    }

    on('chat:message', (msg) => {
        if (msg.type !== 'api') return;
        if (msg.content.startsWith('!mc') !== true) return;
        
        let tokens = msg.content.split(' ');
        if (tokens.length < 2) return;
        let key = tokens[1];
        log(msg.content);
        
        // BR sums
        let infExp = 0;
        let infCount = 0;
        let infTroops = 0;
        let cavExp = 0;
        let cavCount = 0;
        let cavTroops = 0;
        let arcExp = 0;
        let arcCount = 0;
        let arcTroops = 0;
        let magExp = 0;
        let magCount = 0;
        let magTroops = 0;
        let sctExp = 0;
        let sctCount = 0;
        let sctTroops = 0;

        // Upkeep sums
        let purchaseCost = 0;
        let upkeepCost = 0;

        // List of hero names
        let heroList = [];

        // Print toolbox
        if (key === '-overview') {
            let menuString = `&{template:desc} {{desc=`
            + `<h3>Mass Combat Tools</h3><hr><b>Note:</b> All of these functions require selection of tokens to work.`
            + `<br><br><h4>Battle Commands</h4>`
            + `<br>[Damage](!mc -damage ?{Damage Type|Battle|Chaos|Casualty} ?{Amount})`
            + `<br>[Scaled Damage](!mc -scaledDamage ?{Damage Type|Battle|Chaos|Casualty} ?{Amount} ?{Scale})`
            + `<br>[Route Damage](!mc -routeDamage)`
            + `<br>[Disorganize](!mc -disorganize ?{Scale})`
            + `<br>[Recover](!mc -recover)`
            + `<br><br><h4>Other Commands</h4>`
            + `<br>[Long Rest](!mc -longrest ?{Sure you want to long rest|yes|no})`
            + `<br>[Upkeep](!mc -upkeep)`
            + `<br>[Battle Rating](!mc -battleRating)`
            + `}}`;
            sendChat(mcname, menuString);
            return;
        }

        // Iterate through selected tokens
        if (!msg.selected) return;
        msg.selected.forEach((selection) => {
            try {
                // Load token data
                let formToken = getObj('graphic', selection._id);
                let idTag = ` --ids ${formToken._id}`;
                let formName = formToken.get('name');
                let formationType = formToken.get('represents');
                let hp = parseInt(formToken.get('bar1_value'));
                let hpm = parseInt(formToken.get('bar1_max'));
                let cp = parseInt(formToken.get('bar3_value'));
                log(`Operation ${key} on ${formName} with ${hp}/${hpm} hp and ${cp} cp.`);

                // Load charsheet data
                let char = getCharByAny(formationType);
                let isNPC = getAttr(char, 'npc').get('current');
                if (isNPC != 1) {
                    log(`Selected ${formName} is not an NPC`);
                    heroList.push(new Hero(formName, hp, hpm));
                    return;
                }
                let npcType = getAttr(char, 'npc_type').get('current');
                let cr = parseInt(getAttr(char, 'npc_challenge').get('current'));
                let xp = parseInt(getAttr(char, 'npc_xp').get('current'));
                let traits = getAttrsFromSub(char, 'npctrait');
                let formationTraitArray = traits.filter(trait => trait.get('current').includes('Formation of'));
                if(formationTraitArray.length === 0) {
                    log(`Selected ${formName} has no formation trait`);
                    heroList.push(new Hero(formName, hp, hpm));
                    return;
                }
                let formDetails = formationTraitArray[0].get('current');
                log('Form Details: ' + formDetails);
                let formTokens = formDetails.split(' ');
                let formType = formTokens[0];
                let protoCount = parseInt(formTokens[3]);
                let recruitSource = formTokens[4];
                let sourceCreature = formTokens[4];
                if (formTokens.length > 5) {
                    let sourceCreatureIndex = formDetails.indexOf(formTokens[5]);
                    log('Source Index: ' + sourceCreatureIndex);
                    sourceCreature = formDetails.substr(sourceCreatureIndex);
                }

                log(`${npcType} NPC of ${protoCount} CR ${cr} ${sourceCreature} recruited via ${recruitSource}`);

                if (key === '-damage' || key === '-scaledDamage') {
                    if (tokens.length < 4) return;
                    let type = tokens[2];
                    let amount = parseInt(tokens[3]);
                    if (key === '-scaledDamage') {
                        if (tokens.length < 5) return;
                        let damageScale = parseInt(tokens[4]);
                        amount *= damageScale;
                    }
                    log('Damage Type: ' + type);
                    log('Damage Amount: ' + amount);
                    let remHP = Math.max(0, hp-amount);
                    log('Remaining HP: ' + remHP);
                    if (type === 'Battle') {
                        formToken.set('bar1_value', remHP);
                        formToken.set('bar3_value', cp + amount / 2);
                    } else if (type === 'Chaos') {
                        formToken.set('bar1_value', remHP);
                        formToken.set('bar3_value', cp + amount);
                    } else if (type === 'Casualty') {
                        formToken.set('bar1_value', remHP);
                    } else {
                        sendChat(mcname, 'Invalid Damage Type.');
                        return;
                    }
                    sendChat(mcname, `&{template:desc} {{desc=<h3>Damage Received</h3><hr>Victim: <b>${formDetails}</b><br>Damage: <b>${amount} ${type}</b>}}`);
                } else if (key === '-routeDamage') {
                    let remHP = Math.max(0, hp-hpm*.1);
                    formToken.set('bar1_value', remHP);
                    formToken.set('bar3_value', cp + hpm*.1);
                    sendChat(mcname, `&{template:desc} {{desc=<h3>Routed Drain</h3><hr>Victim: <b>${formDetails}</b><br>Damage: <b>${hpm*.1}</b>}}`);
                } else if (key === '-recover') {
                    formToken.set('bar1_value', Math.min(hpm, hp+cp));
                    formToken.set('bar3_value', 0);
                    sendChat(mcname, `&{template:desc} {{desc=<h3>Recovery</h3><hr>Benefactor: <b>${formDetails}</b><br>Regerated: <b>${cp}</b>}}`);
                } else if (key === '-disorganize') {
                    if (tokens.length < 3) return;
                    let disorganizeScale = parseInt(tokens[2]);
                    sendChat(mcname, `&{template:desc} {{desc=<h3>${formName} Disorganized</h3><hr>${formName} has been Disorganized.  If this formation is attacked by another, select this token and pop this damage.<br>[Pop Disorganized](!mc -popDisorganize ${disorganizeScale} ?{Are you sure|yes|no})}}`);
                } else if (key === '-popDisorganize') {
                    if (tokens.length < 4) return;
                    if (tokens[3] !== 'yes') return;
                    let popScale = parseInt(tokens[2]);
                    let amount = hpm * 0.05 * popScale;
                    log(`Popping Disorganized ${formName}, dealing ${amount} direct damage due to scale ${popScale}`);
                    let remHP = Math.max(0, hp-amount);
                    formToken.set('bar1_value', remHP);
                } else if (key === '-longrest') {
                    if (tokens.length < 3) return;
                    if (tokens[2] !== 'yes') return;
                    let postRecovery = hp+cp;
                    let newMax = (hpm-postRecovery)/2 + postRecovery;
                    let reduxPerc = 1 - newMax/hpm;
                    reduxPerc = +reduxPerc.toFixed(2);
                    formToken.set('bar1_value', newMax);
                    formToken.set('bar1_max', newMax);
                    formToken.set('bar3_value', 0);
                    formToken.set('bar3_max', newMax);
                    formToken.set('aura1_radius', 0.7);
                    formToken.set('aura2_radius', 0.7);
                    sendChat(mcname, `&{template:desc} {{desc=<h3>${formName} Long Rest</h3><hr>${formName} has had CP converted to HP.<br>Requires manual reduction in damage by <b>${100*reduxPerc}%</b><br>(multiply by ${1-reduxPerc})}}`);
                } else if (key === '-upkeep') {
                    let upkeep = 0;
                    let buyPrice = 0;
                    let buyString = '0';
                    let formType = '';
                    if (npcType.toLowerCase().includes('undead')) {
                        upkeep = cr * protoCount * 0.1;
                        buyPrice = cr * protoCount * 20;
                        buyString = `Creation: <b>${buyPrice}gp</b><br>`;
                    } else if (npcType.toLowerCase().includes('construct')) {
                        upkeep = cr * protoCount * 0.2;
                        buyPrice = cr * protoCount * 50;
                        buyString = `Creation: <b>${buyPrice}gp</b><br>`;
                    } else if (npcType.toLowerCase().includes('plant')) {
                        upkeep = cr * protoCount * 0.2;
                        buyPrice = cr * protoCount;
                        buyString = `Creation: <b>${buyPrice}gp</b><br>`;
                    } else {
                        let sizeMod = sizeCostArray[getCreatureSize(npcType)];
                        let recruitMod = 1;
                        buyString = '';
                        formType = 'Mercenary ';
                        buyPrice = cr * protoCount;
                        if (recruitSource === 'Levied') {
                            recruitMod = 0.5;
                            buyString = `Procurement: <b>${buyPrice}gp</b><br>`;
                            formType = 'Levied ';
                        }
                        log(`Size Mod: ${sizeMod}  CR: ${cr}  Count: ${protoCount}  Recruit Mod: ${recruitMod}`);
                        upkeep = (sizeMod + cr) * protoCount * recruitMod;
                    }
                    upkeep = +upkeep.toFixed(2);
                    purchaseCost += buyPrice;
                    upkeepCost += upkeep;
                    if (msg.selected.length === 1) {
                        sendChat(mcname, `&{template:desc} {{desc=<h3>${formType}${formName} Cost</h3><hr>${buyString}Upkeep: <b>${upkeep}gp</b><hr>(plus mounts and gear for ${protoCount} ${sourceCreature} if relevant)}}`);
                        return;
                    }
                } else if (key === '-battleRating') {
                    log('Calc Battle Rating');
                    switch (formType.toLowerCase()) {
                        case 'infantry':
                            infExp += protoCount * xp;
                            infCount++;
                            infTroops += protoCount;
                            break;
                        case 'cavalry':
                            cavExp += protoCount * xp;
                            cavCount++;
                            cavTroops += protoCount;
                            break;
                        case 'archers':
                        case 'archer':
                            arcExp += protoCount * xp;
                            arcCount++;
                            arcTroops += protoCount;
                            break;
                        case 'mage':
                        case 'mages':
                            magExp += protoCount * xp;
                            magCount++;
                            magTroops += protoCount;
                            break;
                        case 'scout':
                        case 'scouts':
                            sctExp += protoCount * xp;
                            sctCount++;
                            sctTroops += protoCount;
                            break;
                        default:
                            log('Invalid Formation Type: ' + formType);
                            sendChat(mcname, 'Invalid Formation Type: ' + formDetails);
                            return;
                    }
                } else {
                    log('Unrecognized Input');
                    sendChat(mcname, 'Unrecognized input.');
                }
            } catch (exception) {
                log('Exception caught by Mass Combat: ' + exception);
                sendChat(mcname, 'WARNING: Mass Combat Internal Error.  Contact script author and provide API output console.');
            }
        });

        // Perform any overall operations after all tokens have been processed
        if (key === '-battleRating') {
            let totalExp = infExp + cavExp + arcExp + magExp + sctExp;
            totalExp = totalExp.toExponential(3);

            let armyOverview = `&{template:desc} {{desc=`
            + `<h3>Army Summary</h3>`
                + `<hr><h4>Battle Rating</h4>`
                    + `<b>Total BR:</b> ${totalExp}`
                + (infCount + cavCount + arcCount + magCount + sctCount > 0 ? `<hr><h4>Force Details</h4>` : '')
                    + (infCount > 0 ? `<br><b>Infantry:</b> ${infCount} formation` + (infCount > 1 ? 's' : '') + `<p style="margin-left: 20px">${infTroops} infantrymen</p>` : '')
                    + (cavCount > 0 ? `<br><b>Cavalry:</b> ${cavCount} formation` + (cavCount > 1 ? 's' : '') + `<p style="margin-left: 20px">${cavTroops} cavalrymen</p>` : '')
                    + (arcCount > 0 ? `<br><b>Archers:</b> ${arcCount} formation` + (arcCount > 1 ? 's' : '') + `<p style="margin-left: 20px">${arcTroops} archers</p>` : '')
                    + (magCount > 0 ? `<br><b>Mages:</b> ${magCount} formation` + (magCount > 1 ? 's' : '') + `<p style="margin-left: 20px">${magTroops} mages</p>` : '')
                    + (sctCount > 0 ? `<br><b>Scouts:</b> ${sctCount} formation` + (sctCount > 1 ? 's' : '') + `<p style="margin-left: 20px">${sctTroops} scouts</p>` : '')
                + (heroList.length > 0 ? `<hr><h4>Hero Details</h4>` : '');
            heroList.forEach((hero) => {
                armyOverview += `<p style="margin-left: 20px"><b>${hero.Name}</b>: ${hero.HP}/${hero.MHP}</p>`;
            });
            armyOverview += '}}';
            sendChat(mcname, armyOverview);
        } else if (key === '-upkeep' && msg.selected.length !== 1) {
            sendChat(mcname, `&{template:desc} {{desc=<h3>Army Cost</h3><hr>Procurement Cost: <b>${purchaseCost}</b><br>Upkeep: <b>${upkeepCost}gp</b><hr>(plus mounts and gear for troops if relevant)}}`);
        } else if (heroList.length > 0) {
            sendChat(mcname, 'It looks like you selected one or more heroes but gave no valid input.  Did you forget to mark something as a formation?');
        }
    });

    log(`${mcname} v${v} online.`);
});
