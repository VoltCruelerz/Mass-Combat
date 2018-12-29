/* Mass Combat
*
* A companion script for Kyburn's Mass Combat rule set: 
* https://docs.google.com/document/d/1-56AC-p57x-vr_BzszksjC55kTFK4d67XOzcIb1pWCY/edit?usp=sharing
*
* by Michael Greene
*
*/

on('ready', () => {
    const mcname = 'MassCombat';
    const v = 0.1;

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
                && obj.get('name').indexOf(attrName) !== -1) {
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


    on('chat:message', (msg) => {
        if (msg.type !== 'api') return;
        if (msg.content.startsWith('!mc') !== true) return;
        
        let tokens = msg.content.split(' ');
        if (tokens.length < 2) return;
        let key = tokens[1];
        log(msg.content);
        
        let infExp = 0;
        let infCount = 0;
        let cavExp = 0;
        let cavCount = 0;
        let arcExp = 0;
        let arcCount = 0;
        let magExp = 0;
        let magCount = 0;
        let mntArcExp = 0;
        let mntArcCount = 0;

        if (key === '-overview') {
            let menuString = `&{template:desc} {{desc=`
            + `<h4>Mass Combat Tools</h4><hr><b>Note:</b> All of these functions require selection of tokens to work.`
            + `<br><h5>Battle Commands</h5>`
            + `<br>[Damage](!mc -damage ?{Damage Type|Battle|Chaos|Casualty} ?{Amount})`
            + `<br>[Scaled Damage](!mc -scaledDamage ?{Damage Type|Battle|Chaos|Casualty} ?{Amount} ?{Scale})`
            + `<br>[Route Damage](!mc -routeDamage)`
            + `<br>[Disorganize](!mc -disorganize ?{Scale})`
            + `<br>[Recover](!mc -recover)`
            + `<br><h5>Other Commands</h5>`
            + `<br>[Long Rest](!mc -longrest ?{Sure you want to long rest|yes|no})`
            + `<br>[Upkeep](!mc -upkeep)`
            + `<br>[Battle Rating](!mc -battleRating)`
            + `}}`;
            sendChat(mcname, menuString);
            return;
        }

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
                let npcType = getAttr(char, 'npc_type').get('current');
                let cr = parseInt(getAttr(char, 'npc_challenge').get('current'));
                let xp = parseInt(getAttr(char, 'npc_xp').get('current'));
                let traits = getAttrs(char, 'npctrait');
                let formDetails = traits.filter(trait => trait.get('current').includes('Formation of'))[0].get('current');
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
                } else if (key === '-routeDamage') {
                    let remHP = Math.max(0, hp-hpm*.1);
                    formToken.set('bar1_value', remHP);
                    formToken.set('bar3_value', cp + hpm*.1);
                } else if (key === '-recover') {
                    formToken.set('bar1_value', Math.min(hpm, hp+cp));
                    formToken.set('bar3_value', 0);
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
                    sendChat(mcname, `&{template:desc} {{desc=<h4>${formName} Long Rest</h4><hr>${formName} has had CP converted to HP.<br>Requires manual reduction in damage by <b>${100*reduxPerc}%</b><br>(multiply by ${1-reduxPerc})}}`);
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
                            buyString = `Creation: <b>${buyPrice}gp</b><br>`;
                            formType = 'Levied ';
                        }
                        log(`Size Mod: ${sizeMod}  CR: ${cr}  Count: ${protoCount}  Recruit Mod: ${recruitMod}`);
                        upkeep = (sizeMod + cr) * protoCount * recruitMod;
                    }
                    upkeep = +upkeep.toFixed(2);
                    sendChat(mcname, `&{template:desc} {{desc=<h4>${formType}${formName} Cost</h4><hr>${buyString}Upkeep: <b>${upkeep}gp</b><hr>(plus mounts and gear for ${protoCount} ${sourceCreature} if relevant)}}`);
                } else if (key === '-battleRating') {
                    log('Calc Battle Rating');
                    switch (formType.toLowerCase()) {
                        case 'infantry':
                            infExp += protoCount * xp;
                            infCount++;
                            break;
                        case 'cavalry':
                            cavExp += protoCount * xp;
                            cavCount++;
                            break;
                        case 'archers':
                        case 'archer':
                            arcExp += protoCount * xp;
                            arcCount++;
                            break;
                        case 'mage':
                        case 'mages':
                            magExp += protoCount * xp;
                            magCount++;
                            break;
                        case 'mounted':
                            mntArcExp += protoCount * xp;
                            mntArcCount++;
                            break;
                        default:
                            log('Invalid Formation Type: ' + formType);
                            sendChat(mcname, 'Invalid Formation Type: ' + formDetails);
                            return;
                    }
                } else {
                    sendChat(mcname, 'Unrecognized input.');
                }
            } catch (exception) {
                log('Exception caught by Mass Combat: ' + exception);
            }
        });

        if (key === '-battleRating') {
            let cavScale = 2 * cavExp;
            let arcScale = arcExp * arcCount * arcCount;
            let magScale = magExp * magCount * (1 + Math.log(1 + magCount));
            let mntArcScale = 2 * mntArcExp;
            log(`Inf: ${infExp}, Cav: ${cavScale}, Arc: ${arcScale}, Mag: ${magScale}, Mnt Arc: ${mntArcScale}`);

            let totalExp = infExp + cavScale + arcScale + magScale + mntArcScale;
            log('Total EXP: ' + totalExp);
            totalExp = totalExp.toExponential(3);
            sendChat(mcname, `&{template:desc} {{desc=<h4>Battle Rating</h4><hr>Total BR of Selected Formations: <b>${totalExp}</b>}}`);
        }
    });

    log(`${mcname} v${v} online.`);
});
