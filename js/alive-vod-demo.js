//We will load this values form URL vars 
//Example:
//https://www.myserver.com/clip_demo_prod.html?env=qa&apikey=abcedfghijklmopq&vc_creds_name=VCcreds&jobid=abcd1234abcd1234abcd1234abcd1234

var apiKey = "";
var jobId = "";
var videocloud_cred = "";

//PROD base url
var baseUrl = "https://api.bcovlive.io/v1";

var gl_job = {
    "job_id:": "",
    "gl_live_playlist": "",

    "gl_vod_playlist": "",
    "gl_vod_current_deleted_duration_s": 0.0
};

function onLoadPage() {
    var url_vars = getUrlVars();

    console.log("URL detected vars = " + JSON.stringify(url_vars));

    //Use QA/ST env if is explicitly specified
    if ("env" in url_vars) {
        if (url_vars.env == "qa")
            baseUrl = "https://api-qa.a-live.io/v1";
        else if (url_vars.env == "st")
            baseUrl = "https://api-st.a-live.io/v1";
    }

    apiKey = url_vars.apikey;
    videocloud_cred = url_vars.vc_creds_name;
    jobId = url_vars.jobid;

    console.log("Detected params apiKey = " + apiKey + ", videocloud_cred: " + videocloud_cred + ". JobId: " + jobId);
}

function getUrlVars() {
    var vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
      vars[key] = value;
    });

    return vars;
  }

function refreshReadOnlyValue(ref, data) {
    $("#" + ref).removeAttr("readonly");

    var linkRef = document.getElementById(ref);
    if ((data === null) || (data == ""))
        linkRef.value = "-";

    linkRef.value = data;

    $("#" + ref).attr("readonly", true);
}

function refreshHiddenValue(ref, data) {
    var linkRef = document.getElementById(ref);
    if ((data === null) || (data == ""))
        linkRef.value = "-";

    linkRef.value = data;
}

function loadVideoWithTimer(url, play) {

    player.src({
        type: "application/x-mpegURL",
        src: url
    });
    console.log("Loaded playlist: " + url);

    if (play == true) {
        player.play();
        console.log("Play!");
    }
}

function timeToSeconds(time) {
    var timeArr = time.split(":");
    var hour = Number(timeArr[0]);
    var minute = Number(timeArr[1]);
    var second = Number(timeArr[2]);
    return hour * 3600 + minute * 60 + second;
}

function getVodStatus(jvod_id, clip_name) {
    var url = baseUrl + "/ui/jobs/vod/" + jvod_id;

    $.ajax({
        url: url,
        method: 'GET',
        dataType: 'json',
        timeout: 15000,
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        data: "",
        success: function(data) {
            if ("errorType" in data) {
                console.log("Error 1");
                return showError(data.errorMessage);
            }
            else {
                var status = data.vod.jvod_state;

                console.log("Status = " + status);
                refreshReadOnlyValue(jvod_id + "_status", status);

                if (status == "creating_asset") {
                    console.log("status: creating_asset (available in S3!)");

                    setTimeout( function() { getVodStatus(jvod_id, clip_name); }, 2000);
                }
                else if (status == "finished") {
                    console.log("status: finished (Preview in VC available!)");
                }
                else if (status == "failed") {
                    console.log("ERROR !!! VOD Failed");
                }
                else {
                    setTimeout( function() { getVodStatus(jvod_id, clip_name); }, 2000);
                }
            }
        },
        error: function(msg) {
            console.log("Error 2");
            return showError(msg);
        }
    });
}

function refreshVodStatus(jvod_id, clip_name) {
    var clip_list = document.getElementById('clip_list');

    var newclip = clip_list.insertRow(-1);

    var newclip_name = newclip.insertCell(0);
    var newclip_status = newclip.insertCell(1);

    newclip_name.innerHTML = ""+clip_name;

    var newclip_status_label = document.createElement('input');
    newclip_status_label.setAttribute('style', "width:150px");
    newclip_status_label.setAttribute('id', jvod_id+"_status");
    newclip_status_label.setAttribute('readonly', true);
    newclip_status_label.setAttribute('value', "waiting");
    newclip_status.appendChild(newclip_status_label);

    newclip.setAttribute('id', jvod_id);
    clip_list.appendChild(newclip);

    getVodStatus(jvod_id, clip_name);
}

function createVod() {
    var url = baseUrl + "/vods";

    var in_time_s = timeToSeconds(document.getElementById('set_in_time').value);
    var in_total_deleted = parseFloat(document.getElementById('totaldetetedin').value);
    var set_in_time_s = in_time_s + in_total_deleted;
    console.log("Compensating IN point. In stream: " + in_time_s + ". Total deleted: " + in_total_deleted + ". Result: " + set_in_time_s);

    var out_time_s = timeToSeconds(document.getElementById('set_out_time').value);
    var out_total_deleted = parseFloat(document.getElementById('totaldetetedout').value);
    var set_out_time_s = out_time_s + out_total_deleted;
    console.log("Compensating OUT point. In stream: " + out_time_s + ". Total deleted: " + out_total_deleted + ". Result: " + set_out_time_s);

    var clip_name = document.getElementById('clip_name').value;
    var clip_tags = document.getElementById('clip_tags').value;

    if(clip_name.trim() == "") {
      alert("Clip Name can't be empty !");
      return;
    }

    var clip_tags_arr = clip_tags.split(",");

    var data = {
        "live_job_id": jobId,
        "outputs": [{
            "stream_start_time": set_in_time_s,
            "stream_end_time": set_out_time_s,
            "credentials": videocloud_cred,
            "videocloud": {
                "video": {
                    "name": clip_name,
                    "tags": clip_tags_arr
                },
                "ingest": { }
            }
        }]
    };

    console.log("JVOD req: " + JSON.stringify(data));

    $.ajax({
        url: url,
        method: 'POST',
        dataType: 'json',
        timeout: 25000,
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify(data),
        success: function(data) {
            if ("errorType" in data) {
                showError(data.errorMessage);
            }
            else {
                console.log("Create Vod success - " + data.vod_jobs[0].jvod_id);
                refreshVodStatus(data.vod_jobs[0].jvod_id, clip_name);
            }
        },
        error: function(msg) {
            showError(msg);
        }
    });
}

function loadPlaylist(liveOrVod) {
    var url = baseUrl + "/ui/jobs/live/" + jobId;

    //If we already have the playlist value use it do not ask again, they won't change
    if(liveOrVod === "live") {
        if ( (gl_job.gl_live_playlist != "") && (jobId == gl_job.job_id) ) {
            return loadVideoWithTimer(gl_job.gl_live_playlist, true);
        }
    }
    else {
        if ( (gl_job.gl_vod_playlist != "") && ( jobId == gl_job.job_id) ) {
            return loadVideoWithTimer(gl_job.gl_vod_playlist, true);
        }
    }

    $.ajax({
        url: url,
        method: 'GET',
        dataType: 'json',
        timeout: 15000,
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        data: "",
        success: function(data) {
            if ("errorType" in data) {
                return showError(data.errorMessage);
            }
            else {
                if ( ("job_playlists" in data.job) && ("job_outputs" in data.job) && (data.job.job_outputs.length > 0) && ("ui_playback_url" in data.job.job_outputs[0]) && ("ui_playback_url_vod" in data.job.job_outputs[0]) ) {
                    console.log("Selecting the VOD chunklist. Number of renditions: " + data.job.job_outputs.length);

                    var out = getHighestQualityVODUsageRendition(data.job.job_outputs, data.job.job_playlists);

                    gl_job.gl_live_playlist = out.ui_playback_url;
                    gl_job.gl_vod_playlist = out.ui_playback_url_vod;
                    gl_job.job_id =  data.job.job_id;

                    if(liveOrVod === "live")
                        loadVideoWithTimer(gl_job.gl_live_playlist, true);
                    else
                        loadVideoWithTimer(gl_job.gl_vod_playlist, true);
                }
                else {
                    console.log("Error getting job information (id, playback urls)");
                }
            }
        },
        error: function(msg) {
            return showError(msg);
        }
    });
}

function playLive() {
    loadPlaylist("live");
    $("#set_in_time_btn").prop("disabled", true);
    $("#set_out_time_btn").prop("disabled", true);
    type = "live";
    if (!timerSpinning) {
        timerSpinning = true;
        refreshTimer();
    }
}

function playVod() {
    loadPlaylist("vod");
    $("#set_in_time_btn").prop("disabled", false);
    $("#set_out_time_btn").prop("disabled", false);
    type = "vod";
    player.on("loadeddata", goToEndOfVod);
    if (!timerSpinning) {
        timerSpinning = true;
        refreshTimer();
    }
}

function goToEndOfVod() {
    player.off("loadeddata");

    //Set deleted duration for this playlist
    //This line works because we MODIFIED THE PLAYER (VideoJS) to read the tag #VOD-TOTALDELETEDDURATION
    gl_job.gl_vod_current_deleted_duration_s = player.tech_.hls.playlists.media().totalDeletedDuration;

    console.log("goToEndOfVod");
    var duration = player.duration();
    var goto_ts = Math.max(0, duration - 10.0);

    //Uncomment this line to automatic goto the end (-10s) when click DVR
    //player.currentTime(goto_ts); // wind to the end of VOD

    console.log("Deleted duration: " + gl_job.gl_vod_current_deleted_duration_s + ". Current time: " + player.currentTime() + ". Duration: " + duration + ". Goto pos: " + goto_ts);


}

function refreshTimer() {
        refreshReadOnlyValue("current_time", type === "live" ? "--:--:--" : secondsToTime(player.currentTime()));
        setTimeout(refreshTimer, 250.0);
}

function secondsToTime(seconds) {
    var hour = parseInt(seconds / 3600);
    if (hour < 10) {
        hour = '0' + hour;
    }
    var minute = parseInt((seconds % 3600) / 60);
    if (minute < 10) {
        minute = '0' + minute;
    }
    var second = (seconds % 60).toFixed(3);
    if (second < 10) {
        second = '0' + second;
    }
    return [hour, minute, second].join(":");
}

function assignCurrentTimeToSetInTime() {
    var time = player.currentTime();
    refreshReadOnlyValue("set_in_time", secondsToTime(time));

    refreshHiddenValue("totaldetetedin", gl_job.gl_vod_current_deleted_duration_s);
}

function assignCurrentTimeToSetOutTime() {
    var time = player.currentTime();
    refreshReadOnlyValue("set_out_time", secondsToTime(time));

    refreshHiddenValue("totaldetetedout", gl_job.gl_vod_current_deleted_duration_s);
}

function showError(msg) {
  console.log("Error!!! " + JSON.stringify(msg));
}

//Choose the correct rendition to create the VOD (the same that the brain worker will use)
function getHighestQualityVODUsageRendition(outs, playlists) {
    var ret = null;
    var out_index = -1;
    var max_bitrate = 0;


    for (var o = 0; o < outs.length; o++) {
        var out = outs[o];

        if (isIncludedInAlivePlaylist(out, playlists) == true) {
            if (out.video_codec === "PassThru") {
                out_index = o;
                max_bitrate = Number.MAX_SAFE_INTEGER;
            }
            else {
                if (out.video_bitrate_bps > max_bitrate) {
                    out_index = o;
                    max_bitrate = out.video_bitrate_bps;
                }
            }
        }
    }

    if (out_index >= 0)
        ret = outs[out_index];

    return ret;
}

function isIncludedInAlivePlaylist(out, playlists) {
    var ret = false;
    var p = 0;
    while ( (p < playlists.length) && (ret == false) ) {
        var playlist = playlists[p];

        if ( (playlist.type.name == "defaultS3") && ("profile_sources" in playlist) ) {
            var pr = 0;
            while ( (pr < playlist.profile_sources.length) && (ret == false) ) {
                if (out.profile_name == playlist.profile_sources[pr])
                    ret = true;

                pr++;
            }
        }

        p++;
    }

    return ret;
}