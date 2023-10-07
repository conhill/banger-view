const express = require("express");
const bodyParser = require("body-parser");
const busboy = require("connect-busboy");
const path = require("path"); // Used for manipulation with path
const fs = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");
const moment = require("moment");
const request = require("request");

var index = require('./routes/index');
var FormData = require("form-data");
var http = require("http");

const app = express();
const URL_POST = "http://localhost:8080/song";

const uploadPath = path.join(__dirname, "fu/");
fs.ensureDir(uploadPath);

// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');


// set path for static assets
app.use(express.static(path.join(__dirname, 'public')));

// debugger;
console.log("loaded");
// routes
// app.use('/', index);
app.get('/', function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
  res.write('<input type="file" name="filetoupload"><br>');
  res.write('<input type="submit">');
  res.write('</form>');
  return res.end();
})

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  console.log("here2");
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // render the error page
  console.log(err.status);
  console.log(err.message);
  res.status(err.status || 500);
  res.render('error', {status:err.status, message:err.message});
});


app.use(bodyParser.json());

app.use(
  busboy({
    highWaterMark: 2 * 1024 * 1024 // Set 2MiB buffer
  })
);

function pad(num) {
  return ("0" + num).slice(-2);
}

function hhmmss(secs) {
  var minutes = Math.floor(secs / 60);
  secs = secs % 60;
  var hours = Math.floor(minutes / 60);
  minutes = minutes % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  // return pad(hours)+":"+pad(minutes)+":"+pad(secs); for old browsers
}

app.post("/upload", function(req, res, next) {
  console.log(req);
  console.log(res);
});

app.post('/fileupload', function (req, res) {
  var busboy = new Busboy({ headers: req.headers });
  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {

    var saveTo = path.join(__dirname, 'uploads/' + filename);
    file.pipe(fs.createWriteStream(saveTo));
  });

  busboy.on('finish', function() {
    res.writeHead(200, { 'Connection': 'close' });
    res.end("That's all folks!");
  });
   
  return req.pipe(busboy);    
});

app.post("/upload", function(req, res, next) {
  console.log("here3");
  console.log(req);
  console.log(res);
  // debugger;
  req.pipe(req.busboy); // Pipe it through busboy

  req.busboy.on("file", (fieldname, file, filename) => {
    console.log(`Upload of '${filename}' started`);

    // Create a write stream of the new file
    const FILEPATH = path.join(uploadPath, filename);
    const fstream = fs.createWriteStream(FILEPATH);

    // Pipe it trough
    file.pipe(fstream);

    // On finish of the upload
    fstream.on("close", () => {
      ffmpeg.ffprobe(FILEPATH, function(err, meta) {
        // console.log(meta);
        var stream = fs.createWriteStream("cut.wav");
        if (meta.format.duration >= 5) {
          let runTime = Math.floor(meta.format.duration);
          let splitTime = Math.floor(runTime / 2);
          let splitStart = splitTime - 2 > 0 ? splitTime - 2 : 0;
          let splitEnd = splitTime + 3;

          splitStart = hhmmss(splitStart);
          splitEnd = hhmmss(splitEnd);

          try {
            ffmpeg(FILEPATH)
              .addOption("-ac", 1)
              .addOption("-ss", splitStart)
              .addOption("-to", splitEnd)
              .toFormat("wav")
              .pipe(stream);

            stream.on("finish", function() {
              console.log("DONE");
              stream.end();

              const form = new FormData();
              form.append("file", fs.createReadStream("./cut.wav"));

              var request = http.request({
                method: "POST",
                host: "localhost",
                port: "8080",
                path: "/song",
                headers: form.getHeaders()
              });
              form.pipe(request);
            });
          } catch (e) {
            console.log(e);
            console.log(e.code);
            console.log(e.msg);
          }
        } else {
          try {
            ffmpeg(FILEPATH)
              .addOption("-ac", 1)
              .toFormat("wav")
              .pipe(stream);
            fs.createReadStream("./cut.wav").pipe(request.put(URL_POST));
          } catch (e) {
            console.log("error");
            console.log(e);
            console.log(e.code);
            console.log(e.msg);
          }
          // fs.createReadStream('./cut.wav').pipe(request.put(URL_POST))
        }
      });
      // ffmpeg().outputOptions('-ac 1')

      res.redirect("back");
    });
  });
});

// const port = process.env.PORT || 8080;
// app.listen(port, () => {
//   console.log(`Node server listening on port ${port}`);
// });


module.exports = app;
