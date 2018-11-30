module.exports = function(webserver, api) {

    webserver.get('/admin', function(req, res) {
        res.render('index',{
            layout: 'layouts/layout',
        });
    });

    webserver.get('/admin/edit/:name', function(req, res) {
        res.render('edit',{
            layout: 'layouts/layout',
            platform: process.env.PLATFORM || 'web',
            command_id: req.params.name,
        });
    });

    webserver.post('/admin/save', function(req, res) {
        api.saveScripts(req.body).then(function(response) {
            res.json(response)
        })
    });


    // receives: command, user
    webserver.post('/admin/api/script', function(req, res) {
        if (req.body.command) {
            api.getScript(req.body.command).then(function(script) {
                res.json({success: 'ok', data: script});
            }).catch(function(err) {
                if (err) {
                    console.error('Error in getScript',err);
                }
                res.json({});
            })
        } else if (req.body.id) {
            api.getScriptById(req.body.id).then(function(script) {
                res.json(script);
            }).catch(function(err) {
                if (err) {
                    console.error('Error in getScript',err);
                }
                res.json({});
            })
        }
    });


    // receives: command, user
    webserver.get('/admin/api/scripts', function(req, res) {
        api.getScripts(req.query.tag).then(function(scripts) {
            res.json({success: true, data: scripts});
        }).catch(function(err) {
            if (err) {
                console.error('Error in getScripts',err);
            }
            res.json({});
        })
    });



}
