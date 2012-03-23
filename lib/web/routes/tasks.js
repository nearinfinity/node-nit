'use strict';

var async = require('async');
var sf = require('sf');
var htmlUtil = require('../../util/html');
var objectUtil = require('../../util/object');

module.exports = function (app) {
  app.get('/tasks.json', function (req, res, next) {
    app.tracker.getOpenTasks(function (err, tasks) {
      if (err) {
        return next(err);
      }
      tasks = tasks.sort(function (a, b) { return a.getIdNumber() - b.getIdNumber(); })
      res.end(JSON.stringify(tasks, null, '  '));
    });
  });

  app.post('/tasks/:id', function (req, res, next) {
    var taskId = req.params.id;

    app.tracker.getOpenTask(taskId, function (err, task) {
      if (err) {
        return next(err);
      }

      for (var k in req.body) {
        objectUtil.setByPath(task, k, req.body[k]);
      }

      task.updateModifiedAndSave(app.currentUser, function (err) {
        if (err) {
          return next(err);
        }
        res.redirect('/');
      });
    });
  });

  app.get('/tasks/:id', function (req, res, next) {
    var taskId = req.params.id;

    async.auto({
      getOpenTask: app.tracker.getOpenTask.bind(app.tracker, taskId),

      getTaskMetadata: ['getOpenTask', function (callback, results) {
        var task = results.getOpenTask;
        app.tracker.getTaskMetadata(task, callback);
      }],

      getUsers: app.tracker.getUsers.bind(app.tracker)
    }, function (err, results) {
      if (err) {
        return next(err);
      }

      var task = results.getOpenTask;
      var taskMetadata = results.getTaskMetadata;
      var users = results.getUsers;

      res.render('task', {
        title: 'task ' + taskId,
        task: task,
        taskMetadata: taskMetadata,
        getFormHtml: function (fieldMetadata) {
          var fieldValue = task.getFieldValue(fieldMetadata.path);
          switch (fieldMetadata.type) {
            case 'user':
              if (!fieldMetadata.readonly) {
                var options = users.map(
                  function (u) {
                    return u.toString();
                  }).sort();
                options.splice(0, 0, "");
                options = options.map(function (o) {
                  return sf(
                    "<option value=\"{0}\" {1}>{0}</option>",
                    htmlUtil.getFormValueSafeValue(o.toString()),
                    o == fieldValue.toString() ? "selected='selected'" : "");
                });
                return sf(
                  "<select name='{path}'>{1}</select> <a href='javascript:' onclick=\"selectOption('{path}', '{2}');\">me</a>",
                  fieldMetadata,
                  options.join('\n'),
                  app.currentUser.toString());
              }
              break;

            case 'string':
              if (!fieldMetadata.readonly) {
                return sf("<input type='text' name='{path}' value=\"{1}\"/>", fieldMetadata, htmlUtil.getFormValueSafeValue(fieldValue));
              }
              break;

            case 'multilineString':
              if (!fieldMetadata.readonly) {
                return sf("<textarea type='text' name='{path}'>{1}</textarea>", fieldMetadata, htmlUtil.getTextareaSafeValue(fieldValue));
              }
              break;

            case 'array':
              var items = fieldValue
                .filter(function (item) { return item.trim().length > 0; })
                .map(function (item) {
                  return sf("<li>{0}</li>", item);
                });
              return "<ul>" + items.join('\n') + "</ul>";
              break;

            case 'status':
              if (!fieldMetadata.readonly) {
                var options = [];
                options.push("Open");
                options.push("Closed");
                options = options.map(function (o) {
                  return sf("<option {1}>{0}</option>", o, o == fieldValue ? "selected='selected'" : "");
                });
                return sf("<select name='{path}'>{1}</select>", fieldMetadata, options.join('\n'));
              }
              break;
          }
          return fieldValue;
        }
      });
    });
  });
};