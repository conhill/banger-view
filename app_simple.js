var https = require('https'),
    express = require('express'),
    Busboy = require('busboy'),
    path = require('path'),
    fs = require('fs');

const uploadPath = path.join(__dirname, "fu/");
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const moment = require("moment");
var FormData = require("form-data");
var ffprobe = require('ffprobe');
var ffprobeStatic = require('ffprobe-static');
var http = require("http");
// fs.ensureDir(uploadPath);
var app = express();

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


app.get('/', function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
    res.write('<input type="file" name="filetoupload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');
    return res.end();
})

app.post('/fileupload', function (req, res) {
    let FILEPATH;
    try {
        fs.mkdirSync(path.join(__dirname, '/fu/'))
      } catch (err) {
        if (err.code !== 'EEXIST') throw err
    }
    
    var busboy = new Busboy({
        headers: req.headers
    });
    // busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {

    //   var saveTo = path.join(__dirname, 'uploads/' + filename);
    //   file.pipe(fs.createWriteStream(saveTo));
    // });

    // busboy.on('finish', function() {
    //   res.writeHead(200, { 'Connection': 'close' });
    //   res.end("That's all folks!");
    // });

    // return req.pipe(busboy);    
    console.log("here3");
    // console.log(req);
    // console.log(res);
    // debugger;
    req.pipe(busboy); // Pipe it through busboy

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
        console.log(`Upload of '${filename}' started`);
        FILEPATH = path.join(uploadPath, filename);

        // Create a write stream of the new file
        // Pipe it trough
        file.pipe(fs.createWriteStream(FILEPATH));

        // On finish of the upload
    });
    busboy.on("finish", () => {
        console.log(FILEPATH);
        ffprobe(FILEPATH, { path: ffprobeStatic.path }, function (err, meta) {
            // console.log(meta);
            console.log(err);
            if (err) return done(err);
            // console.log(err);
            var stream = fs.createWriteStream("cut.wav");
            // console.log(meta);
            // console.log(meta.streams[0].duration)
            if (meta.streams[0].duration >= 5) {
                let runTime = Math.floor(meta.streams[0].duration);
                let splitTime = Math.floor(runTime / 2);
                let splitStart = splitTime - 2 > 0 ? splitTime - 2 : 0;
                let splitEnd = splitTime + 3;

                splitStart = hhmmss(splitStart);
                splitEnd = hhmmss(splitEnd);

                try {
                    // ffmpeg(FILEPATH)
                    // .setStartTime(splitStart)
                    // .setDuration(5)
                    // .setAudioChannels(1)
                    // .setAudioBitRate(128)
                    // .addCommand('-f', 'wav')
                    // .save(stream);
                    
                    ffmpeg(FILEPATH)
                        .addOption("-ac", 1)
                        .addOption("-ss", splitStart)
                        .addOption("-to", splitEnd)
                        .toFormat("wav")
                        .on('error', function(err) {
                            console.log('An error occurred: ' + err.message);
                        })
                        .on('end', function() {
                            console.log('Processing finished !');
                            let form = new FormData();
                            // form.append("file", stream);
                      
                            const options = {
                                method: "POST",
                                hostname: "bangerr-api.herokuapp.com",
                                protocol: 'https:',
                                port: process.env.PORT,
                                path: "/song",
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                formData : {
                                    "file" : stream
                                }
                            };
                            
                            https.request(options, function (err, res, body) {
                                if(err) console.log(err);
                                console.log(body);
                            });
                            
                        })
                        .pipe(stream, { end: true });
                        
                    // stream.on("end", function () {
                    //     console.log("DONE");
                    //     // stream.end();

                    //     let form = new FormData();
                    //     form.append("file", fs.createReadStream("cut.wav"));
                    //     // console.log("here22");
                    //     // http.request({
                    //     //   method: "POST",
                    //     //   host: "https://bangerr-api.herokuapp.com",
                    //     //   port: "22",
                    //     //   path: "/song",
                    //     //   headers: form.getHeaders()
                    //     // });

                    //     // let formData = new FormData();
                    //     // formData.append("firstName", "John");
                    //     // formData.append("image", imageBlob, "image.png");
                  
                    //     const options = {
                    //         method: "POST",
                    //         url: "https://bangerr-api.herokuapp.com",
                    //         port: 22,
                    //         headers: form.getHeaders(),
                    //         formData : {
                    //             "file" : fs.createReadStream("cut.wav")
                    //         }
                    //     };
                        
                    //     request(options, function (err, res, body) {
                    //         if(err) console.log(err);
                    //         console.log(body);
                    //     });

                    //     // http.
                    //     // form.pipe(request);
                    // });
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
app.set('port', (process.env.PORT));
app.listen(process.env.PORT || 8000)