module.exports = function(db) {

    var api = {}
    var scripts = [];
    var triggers = [];
    var db = db;
    var PATH_TO_SCRIPTS;

    api.parseAdminUsers = function(string) {

        var creds = string.split(/\s+/);

        var users = {};
        creds.forEach(function(u) {
            var bits = u.split(/\:/);
            users[bits[0]] = bits[1];
        });

        return users;

    }

    api.loadScriptsFromFile = function(src) {
        return new Promise(function(resolve, reject) {
            try {
                scripts = require(src);
            } catch(err) {
                return reject(err);
            }

            PATH_TO_SCRIPTS = src;
            resolve(scripts);
        });
    }

    api.writeScriptsToFile = function(new_scripts, alt_path) {

        return new Promise(function(resolve, reject) {
            try {
                require('fs').writeFileSync(alt_path || PATH_TO_SCRIPTS, JSON.stringify(new_scripts,null,2));
            } catch(err) {
                return reject(err);
            }

            scripts = new_scripts;
            resolve(scripts);
        });

    }

    api.writeScriptsToDb = function(new_scripts) {
        return new Promise(function(resolve, reject) {
            db.collection('scripts').insertMany(scripts, function(err, result) {
                console.log(err);

                resolve(result.toArray());
            });
        });
    }

    api.writeScripts = function(new_scripts, alt_path) {
        return new Promise(function(resolve, reject) {
            try {
                if (db === null) {
                    scripts = api.writeScriptsToFile(new_scripts, alt_path);
                } else {
                    scripts = api.writeScriptsToDb(new_scripts);
                }
            } catch(err) {
                return reject(err);
            }

            api.mapTriggers();
            resolve(scripts);
        });
    }

    }

    api.saveScripts = function(update) {
        return new Promise(function(resolve, reject) {
            if (db === null) {
                // TODO: ensure modified is not in past
                // update.modified = new Date();
                api.getScripts().then(function(scripts) {
                    var found = false;
                    for (var s = 0; s < scripts.length; s++) {
                        if (scripts[s].command == update.command) {
                            found = s;
                            console.log('found timestamp', scripts[s].modified, 'incoming timestamp:', update.modified);
                        }
                    }
        
                    if (found === false) {
        
                        update.modified = new Date();
                        scripts.push(update);
        
                        api.writeScripts(scripts).then(function() {
                            resolve({
                                success: true,
                                data: update,
                            });
                        });
        
                    } else if (new Date(scripts[found].modified) > new Date(update.modified)) {
        
                        // if the version in the database was more recently modified, reject this update!
                        resolve({
                            success: false,
                            message: 'Script was modified more recently, please refresh your browser to load the latest',
                        });
        
                    } else {
        
                        scripts[found] = update;
                        scripts[found].modified = new Date();
                        console.log('Updating modified date to', scripts[found].modified);
        
                        api.writeScriptsToFile(scripts).then(function() {
                            resolve({
                                success: true,
                                data: update,
                            });
                        });
                    }
                });
            } else {
                update.modified = new Date();
                delete update._id;
                db.collection('scripts').updateOne({'command': update.command}, { $set: update }, {upsert: true}, function(err, res) {
                    resolve({
                        success: true,
                        data: update,
                    });
                });
            }
        });
    }


    api.mapTriggers = function() {
        for (var s = 0; s < scripts.length; s++) {

            // TODO: remove this when ID is part of datafile
            scripts[s].id = s;

            for (var t = 0; t < scripts[s].triggers.length; t++) {
                triggers.push({trigger: scripts[s].triggers[t], script: s});
            }
        }

        // sort in the order of _descending pattern length_
        triggers.sort(function(a,b) {

            return b.trigger.pattern.length - a.trigger.pattern.length;

        });
    }

    api.evaluateTriggers = function(query) {

        return new Promise(function(resolve, reject) {
            var res = [];

            // check regular expressions first
            for (var t = 0; t < triggers.length; t++) {
                var trigger = triggers[t].trigger;

                if (trigger.type == 'regexp') {

                    var found = false;
                    try {
                        var test = new RegExp(trigger.pattern,'i');
                        found = query.match(test);
                    } catch(err) {
                        console.log('ERROR IN REGEX', err);
                    }

                    if (found !== false && found !== null) {
                        res.push(triggers[t].script);
                    }
                }
            }

            for (var t = 0; t < triggers.length; t++) {
                var trigger = triggers[t].trigger;

                if (trigger.type == 'string') {

                    var found = false;
                    try {
                        var test = new RegExp('^' + trigger.pattern + '\\b','i');
                        found = query.match(test);
                    } catch(err) {
                        console.log('ERROR IN REGEX', err);
                    }

                    if (found !== false && found !== null) {
                        res.push(triggers[t].script);
                    }
                }
            }

            if (res.length) {
                resolve(scripts[res[0]]);
            } else {
                reject();
            }
        });

    }

    api.getScript = function(name) {

        return new Promise(function(resolve, reject) {
            if (db === null) {
                for (var s = 0; s < scripts.length; s++) {
                    if (name.toLowerCase() == scripts[s].command.toLowerCase()) {
                        return resolve(scripts[s]);
                    }
                }
            } else {
                db.collection('scripts').findOne({ 'command': name.toLowerCase() }, function(err, response) {
                    return resolve(response);
                })
            }
            
        });
    }

    api.getScriptById = function(id) {

        return new Promise(function(resolve, reject) {
            if (db === null) {
                for (var s = 0; s < scripts.length; s++) {
                    if (id == scripts[s]._id) { // TODO: why use mongo style id?
                        return resolve(scripts[s]);
                    }
                }
            } else {
                db.collection('scripts').findOne({ 'command': id }, function(err, response) {
                    return resolve(response);
                })
            }
            reject();
        });
    }

    api.getScripts = function(tag) {

        return new Promise(function(resolve, reject) {
            
            if (db === null) {
                if (tag) {
                    resolve(scripts.filter(function(s) {
                        return s.tags ? (s.tags.indexOf(tag) >= 0) : false;
                    }))
                } else {
                    resolve(scripts);
                }
            } else {
                if (tag) {
                    query = {'tag': tag}
                } else {
                    query = {}
                }
                db.collection('scripts').find(query, function(err, result) {
                    resolve(result.toArray());
                });
            }
            
        });

    }


    api.useLocalStudio = function(botkit) {

        var mutagen = require(__dirname + '/botkit_mutagen.js');
        return mutagen(api, botkit);
    }

    return api;

}
