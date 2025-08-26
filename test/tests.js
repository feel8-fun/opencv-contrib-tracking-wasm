let testrunner = require('node-qunit');
testrunner.options.maxBlockDuration = 20000; // cause opencv_js.js need time to load


testrunner.run(
    {
        code: {path: "dist/wasm/opencv.js", namespace: "cv"},
        tests: ['test/init_cv.js',
                'test/test_video.js',
        ],
    },
    function(err, report) {
        console.log(report.failed + ' failed, ' + report.passed + ' passed');
        if (report.failed || err) {
            if (err) {
                console.log(err);
            }
            process.on('exit', function() {
                process.exit(1);
            });
        }
    }
);