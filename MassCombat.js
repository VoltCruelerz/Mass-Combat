if (typeof MarkStart != 'undefined') {MarkStart('MassCombat');}
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
    const v = 0.5;
    const cache = {};

    // Initialize the state
    if (!state.MassCombat) {
        state.MassCombat = {
            SavedInitiative: []
        };
    }

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
            log('No Attr: ' + char + ': ' + attrName);
            return null;
        }
        return attr;
    }

    const getAttr = (char, attrName) => {
        let attr = getAttrs(char, attrName);
        if (!attr) {
            return null;
        }
        return attr[0];
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
            log('No Substr Attr: ' + char + ': ' + attrName);
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

    class Status {
        constructor(type, value) {
            this.Type = type;
            this.Value = value;
        }
    }

    const GetStatuses = (token) => {
        const rawStatus = token.get('statusmarkers');
        const oldStatusArray = rawStatus.split(',');
        const newStatusArray = [];
        let previousType = false;
        let prevStatus = null;
        oldStatusArray.forEach((entry) => {
            const statusFields = entry.split('@');
            const type = statusFields[0];
            const value = statusFields.length > 1
                ? statusFields[1]
                : true;
            let newStatus = null;
            // If we've already gotten one of this kind, we're seeing a duplicate, so add to previous
            if (type === previousType) {
                newStatus = prevStatus;
                prevStatus.Value = prevStatus.Value + value;
            } else {
                newStatus = new Status(type, value);
                newStatusArray.push(newStatus);
            }
            previousType = type;
            prevStatus = newStatus;
        });
        return newStatusArray;
    };

    const GetStatusValue = (token, type) => {
        const statuses = GetStatuses(token);
        for(let i = 0; i < statuses.length; i++) {
            const curStatus = statuses[i];
            if (type === curStatus.Type) {
                const intVal = parseInt(curStatus.Value);
                if (isNaN(intVal)) {
                    return curStatus.Value;
                } else {
                    return intVal;
                }
            }
        }
        return false;
    };

    const StringifyStatus = (status) => {
        if (status.Value === true) {
            return status.Type;
        } else {
            const strVal = status.Value + "";
            const digitArray = strVal.split('');
            const valArray = [];
            for (let i = 0; i < digitArray.length; i++) {
                let char = digitArray[i];
                valArray.push(status.Type + '@' + char);
            }
            return valArray.join(',');
        }
    };

    const UpdateStatusValue = (token, type, value) => {
        let alreadyExists = false;
        const statuses = GetStatuses(token);
        for(let i = 0; i < statuses.length; i++) {
            const curStatus = statuses[i];
            if (type === curStatus.Type) {
                curStatus.Value = value;
                alreadyExists = true;
                break;
            }
        }
        if (!alreadyExists) {
            statuses.push(new Status(type, value));
        }
        const statusStrings = [];
        for (let i = 0; i < statuses.length; i++) {
            const curStatus = statuses[i];
            statusStrings.push(StringifyStatus(curStatus));
        }
        const statusString = statusStrings.join(',');
        token.set('statusmarkers', statusString);
        return value;
    };

    const StatusIcons = {
        Routed: "status_chained-heart",
        Guard: "status_sentry-gun",
        Defend: "status_bolt-shield",
        Disorganized: "status_rolling-bomb",
        Dead: "status_dead"
    };

    const StripStatus = (icon) => {
        const prefix = "status_";
        return icon.substr(prefix.length);
    }

    const LeftAlignDiv = {
        Open: `<div align="left" style="margin-left: 7px;margin-right: 7px">`,
        Close: '</div>'
    };

    const printBattleRating = (infExp, infCount, infTroops, cavExp, cavCount, cavTroops, arcExp, arcCount, arcTroops, magExp, magCount, magTroops, sctExp, sctCount, sctTroops, heroList) => {
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
    };

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

        // Perform operations without needed selection
        if (key === '-overview' || key === '-o' || key === '-help') {
            let menuString = `&{template:desc} {{desc=`
            + LeftAlignDiv.Open
            + `<h3>Mass Combat Tools</h3><hr>`
            + `<h4>Battle Commands</h4>`
            + `<b>Note:</b> All of these functions require selection of tokens to work.`
                + `<br>[Damage](!mc -damage ?{Damage Type|Battle|Chaos|Casualty} ?{Amount})`
                + `<br>[Scaled Damage](!mc -scaledDamage ?{Damage Type|Battle|Chaos|Casualty} ?{Amount} ?{Scale})`
                + `<br>[Disorganize](!mc -disorganize ?{Please type the new disorganization scale.  Type 'false' to remove existing disorganization})`
                + `<br>[Pop Disorganize](!mc -popDisorganize ?{Are you sure you wish to pop disorganization|yes|no})`
                + `<br>[Recover](!mc -recover)`
                + `<br>[Heal](!mc -heal ?{Points of healing})`
                + `<br>[Guard](!mc -guard)`
                + `<br>[Defend](!mc -defend)`
                + `<br>[Route](!mc -route ?{Route Degree|Not Routed,-1|0 Failures,0|1 Failure,1|2 Failures,2|3 Failures,3})`
                + `<br>[Route Damage](!mc -routeDamage)`
            + `<br><br><h4>Initiative Commands</h4>`
                + `<br>[Save Initiative](!mc -saveInitiative)`
                + `<br>[Load Initiative](!mc -loadInitiative)`
            + `<br><br><h4>Other Commands</h4>`
            + `<b>Note:</b> All of these functions require selection of tokens to work.`
                + `<br>[Long Rest](!mc -longrest ?{Sure you want to long rest|yes|no})`
                + `<br>[Upkeep](!mc -upkeep)`
                + `<br>[Battle Rating](!mc -battleRating)`
            + LeftAlignDiv.Close
            + `}}`;
            sendChat(mcname, menuString);
            return;
        } else if (key === '-saveInitiative') {
            let turnorder = [];
            let existingOrder = Campaign().get('turnorder');
            if (existingOrder != '') {
                turnorder = JSON.parse(existingOrder);
            } else {
                sendChat(mcname, 'ERROR: There is no initiative order to save.');
                return;
            }
            state.MassCombat.SavedInitiative = turnorder;
            let saveMessage = `&{template:desc} {{desc=Turn Order Saved.}}`;
            sendChat(mcname, saveMessage);
            return;
        } else if (key === '-loadInitiative') {
            Campaign().set('turnorder', JSON.stringify(state.MassCombat.SavedInitiative));
            state.MassCombat.SavedInitiative = [];
            let saveMessage = `&{template:desc} {{desc=Turn Order Loaded.}}`;
            sendChat(mcname, saveMessage);
            return;
        }

        // Iterate through selected tokens
        if (!msg.selected) return;
        let processed = 0;

        // Wait Duration Warning Messages
        let wait = 0;
        if (msg.selected.length > 0) {
            if (key === '-battleRating'){
                sendChat(mcname, 'Calculating Battle Rating.  This may take a few moments...');
                wait = 100;
            } else if (key === '-upkeep'){
                sendChat(mcname, 'Calculating Upkeep.  This may take a few moments...');
                wait = 100;
            }
        }
        setTimeout(() => {
            msg.selected.forEach((selection) => {
                _.defer(() => {
                    processed++;
                    
                    // Load token data.  Unfortunately, we can't use the cache for this because you could have mook tokens with different hp bars
                    let formToken = getObj('graphic', selection._id);
                    let formationType = formToken.get('represents');
                    let formName = formToken.get('name');
                    let hp = parseInt(formToken.get('bar1_value'));
                    let hpm = parseInt(formToken.get('bar1_max'));
                    let cp = parseInt(formToken.get('bar3_value'));
                    log(`Operation ${key} on ${formName} with ${hp}/${hpm} hp and ${cp} cp.`);
    
                    // Load charsheet data.  Use a cache for this
                    let cacheEntry = cache[formationType];
                    if (!cacheEntry) {
                        buildNewEntry = true;
                        let char = getCharByAny(formationType);

                        // Discount accidental selections of unowned tokens or graphics
                        if (!char) {
                            return;
                        }

                        // Filter NPCs vs PCs
                        const npcAttr = getAttr(char, 'npc');
                        let isNPC = false;
                        if (npcAttr && (isNPC = npcAttr.get('current'))) {
                            let traits = getAttrsFromSub(char, 'npctrait');

                            // Discount non-formation NPCs
                            if (!traits) {
                                heroList.push(new Hero(formName, hp, hpm));
                                return;
                            }

                            // Get formation values
                            let formationTraitArray = traits.filter(trait => trait.get('current').includes('Formation of'));
                            if(formationTraitArray.length === 0) {
                                cacheEntry = {
                                    char: char,
                                    isNPC: isNPC,
                                    isHero: true,
                                    npcType: getAttr(char, 'npc_type').get('current'),
                                    cr: parseInt(getAttr(char, 'npc_challenge').get('current')),
                                    xp: parseInt(getAttr(char, 'npc_xp').get('current')),
                                    traits: traits,
                                    formationTraitArray: formationTraitArray
                                };
                            } else {
                                let formDetails = formationTraitArray[0].get('current');
                                cacheEntry = {
                                    char: char,
                                    isNPC: isNPC,
                                    isHero: false,
                                    npcType: getAttr(char, 'npc_type').get('current'),
                                    cr: parseInt(getAttr(char, 'npc_challenge').get('current')),
                                    xp: parseInt(getAttr(char, 'npc_xp').get('current')),
                                    traits: traits,
                                    formationTraitArray: formationTraitArray,
                                    formDetails: formDetails
                                };
                            }
                        } else {
                            cacheEntry = {
                                char: char,
                                isNPC: isNPC,
                                isHero: true
                            };
                        }
                        cache[formationType] = cacheEntry;
                    }
                    if (cacheEntry.isHero) {
                        log(`Selected ${formName} is not an NPC`);
                        heroList.push(new Hero(formName, hp, hpm));
                        if (processed === msg.selected.length) {
                            if (key === '-battleRating') {
                                printBattleRating(infExp, infCount, infTroops, cavExp, cavCount, cavTroops, arcExp, arcCount, arcTroops, magExp, magCount, magTroops, sctExp, sctCount, sctTroops, heroList);
                            } else if (key === '-upkeep') {
                                sendChat(mcname, `&{template:desc} {{desc=<h3>Army Cost</h3><hr>Procurement Cost: <b>${purchaseCost}</b><br>Upkeep: <b>${upkeepCost}gp</b><hr>(plus mounts and gear for troops if relevant)}}`);
                            }
                        }
                        return;
                    }
                    let npcType = cacheEntry.npcType;
                    let cr = cacheEntry.cr;
                    let xp = cacheEntry.xp;
                    let formDetails = cacheEntry.formDetails;
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
                        let chaosBurn = hp-amount < 0 ? hp-amount : 0;
                        let remHP = Math.max(0, hp-amount);
                        log('Remaining HP: ' + remHP);
                        log('Chaos Burn: ' + chaosBurn);
                        if (type === 'Battle') {
                            formToken.set('bar1_value', remHP);
                            formToken.set('bar3_value', Math.max(0, cp + amount / 2 + chaosBurn));
                        } else if (type === 'Chaos') {
                            formToken.set('bar1_value', remHP);
                            formToken.set('bar3_value', Math.max(0, cp + amount + chaosBurn));
                        } else if (type === 'Casualty') {
                            formToken.set('bar1_value', remHP);
                            formToken.set('bar3_value', Math.max(0, cp + chaosBurn));
                        } else {
                            sendChat(mcname, 'Invalid Damage Type.');
                            return;
                        }
                        sendChat(mcname, `&{template:desc} {{desc=<h3>Damage Received</h3><hr>${LeftAlignDiv.Open}<b>Victim:</b> ${formDetails}<br><b>Damage:</b> ${amount} ${type}${LeftAlignDiv.Close}}}`);
                    } else if (key === '-routeDamage') {
                        let remHP = Math.max(0, hp-hpm*.1);
                        formToken.set('bar1_value', remHP);
                        formToken.set('bar3_value', cp + hpm*.1);
                        sendChat(mcname, `&{template:desc} {{desc=<h3>Routed Drain</h3><hr${LeftAlignDiv.Open}<b>Victim:</b> ${formDetails}<br><b>Damage:</b> ${hpm*.1}${LeftAlignDiv.Close}}}`);
                    } else if (key === '-recover') {
                        formToken.set('bar1_value', Math.min(hpm, hp+cp));
                        formToken.set('bar3_value', 0);
                        sendChat(mcname, `&{template:desc} {{desc=<h3>Recovery</h3><hr>${LeftAlignDiv.Open}<b>Benefactor:</b> ${formDetails}<br><b>Regerated:</b> ${cp}${LeftAlignDiv.Close}}}`);
                    } else if (key === '-disorganize') {
                        if (tokens.length < 3) return;
                        let disorganizeScale = parseInt(tokens[2]);
                        formToken.set(StatusIcons.Disorganized, "" + disorganizeScale);
                        let type = StripStatus(StatusIcons.Disorganized);
                        UpdateStatusValue(formToken, type, disorganizeScale);
                    } else if (key === '-popDisorganize') {
                        if (tokens.length < 3) return;
                        if (tokens[2] !== 'yes') return;
                        let type = StripStatus(StatusIcons.Disorganized);
                        const popScale = GetStatusValue(formToken, type);
                        log('Disorganization Scale of Token: ' + popScale);
                        if (popScale !== true) {
                            let amount = hpm * 0.05 * popScale;
                            log(`Popping Disorganized ${formName}, dealing ${amount} direct damage due to scale ${popScale}`);
                            let remHP = Math.max(0, hp-amount);
                            formToken.set('bar1_value', remHP);
                            formToken.set(StatusIcons.Disorganized, false);
                            sendChat(mcname, `&{template:desc} {{desc=<h3>Disorganization Popped</h3><hr>${LeftAlignDiv.Open}<b>Victim:</b> ${formDetails}<br><b>Damage:</b> ${amount} casualty${LeftAlignDiv.Close}}}`);
                        } else {
                            sendChat(mcname, 'That token was not marked as disorganized!  Unable to pop.');
                        }
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
                        let reduxScalar = 1-reduxPerc;
                        sendChat(mcname, `&{template:desc} {{desc=<h3>${formName} Long Rest</h3><hr>${formName} has had CP converted to HP.<br>Requires manual reduction in damage by <b>${100*reduxPerc}%</b><br>(multiply by ${reduxScalar.toFixed(2)})}}`);
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
                        if (processed === msg.selected.length) {
                            sendChat(mcname, `&{template:desc} {{desc=<h3>Army Cost</h3><hr>Procurement Cost: <b>${purchaseCost}</b><br>Upkeep: <b>${upkeepCost}gp</b><hr>(plus mounts and gear for troops if relevant)}}`);
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
                        if (processed === msg.selected.length) {
                            _.defer(() => {
                                printBattleRating(infExp, infCount, infTroops, cavExp, cavCount, cavTroops, arcExp, arcCount, arcTroops, magExp, magCount, magTroops, sctExp, sctCount, sctTroops, heroList);
                            });
                        }
                    } else if (key === '-defend') {
                        const isDefending = formToken.get(StatusIcons.Defend);
                        log('Defending Value: ' + isDefending);
                        formToken.set(StatusIcons.Defend, !isDefending);
                    } else if (key === '-guard') {
                        const isGuarding = formToken.get(StatusIcons.Guard);
                        log('Guarding Value: ' + isGuarding);
                        formToken.set(StatusIcons.Guard, !isGuarding);
                    } else if (key === '-route') {
                        formToken.set(StatusIcons.Guard, false);
                        formToken.set(StatusIcons.Defend, false);
                        if (tokens.length < 3) return;
                        let newRouteValue = parseInt(tokens[2]);
                        if (newRouteValue === -1) {
                            formToken.set(StatusIcons.Routed, false);
                        } else if (newRouteValue === 0) {
                            formToken.set(StatusIcons.Routed, true);
                        } else if (newRouteValue === 1) {
                            formToken.set(StatusIcons.Routed, "1");
                        } else if (newRouteValue === 2) {
                            formToken.set(StatusIcons.Routed, "2");
                        } else {
                            formToken.set(StatusIcons.Routed, false);
                            formToken.set(StatusIcons.Dead, true);
                        }
                    } else if (key === '-heal') {
                        if (tokens.length < 3) return;
                        let healVal = parseInt(tokens[2]);
                        let missingVitality = hpm - cp - hp;
                        let realHeal = Math.min(healVal, missingVitality);
                        log(`Attempting Heal of ${healVal}, which was reduced to ${realHeal}`);
                        formToken.set('bar1_value', hp + realHeal);
                        const capString = realHeal < healVal
                            ? `, capped at <b>${realHeal}`
                            : ``;
                        sendChat(mcname, `&{template:desc} {{desc=<h3>Healing Received</h3><hr>${LeftAlignDiv.Open}<b>Recipient:</b> ${formDetails}<br><b>Healing</b>: ${healVal}${capString}${LeftAlignDiv.Close}}}`);
                    } else {
                        log('Unrecognized Input');
                        sendChat(mcname, 'Unrecognized input.');
                    }
                });
            });
        }, wait);
    });

    log(`-=> ${mcname} v${v} online. <=-`);
});
if (typeof MarkStop != 'undefined') {MarkStop('MassCombat');}
