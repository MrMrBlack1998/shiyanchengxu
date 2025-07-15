// 飞行方向判断实验网页版核心逻辑（自动mark后台实现）
let planeImg, instrImg;
let SCREEN_WIDTH = 1680, SCREEN_HEIGHT = 850;
let phase = "input"; // input, instruction, practice, block1, block2, block3, finish
let subjectId = "", subjectAge = "";
let inputActive = "id";
let planes = [];
let results = [];
let blockResults = [];
let trialIdx = 0;
let blockParams = [
  {num_trials:10, num_planes:20, duration:5000, speed:2, practice:true, name:"练习"},
  {num_trials:60, num_planes:20, duration:5000, speed:3, practice:false, name:"简单"},
  {num_trials:60, num_planes:40, duration:4000, speed:3, practice:false, name:"中等"},
  {num_trials:60, num_planes:80, duration:3000, speed:3, practice:false, name:"困难"}
];
let currentBlock = 0;
let trialPlanes = [];
let trialStart, responded, responseKey, rt, correct, correctResponse, error;
let feedbackTimer = 0;
let fixationTimer = 0;
let showFeedback = false;

// 自动mark相关
let port = null;
let markRecords = [];

// 串口连接函数（实验开始弹窗，用户选COM3）
async function connectSerial() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    // 可选：alert('串口已连接！');
  } catch (e) {
    port = null;
    alert('串口连接失败，可继续实验，但mark只本地记录');
  }
}

// 自动mark记录函数
async function autoMark(markCode, markLabel) {
  markRecords.push({
    time: new Date().toLocaleString(),
    code: markCode,
    label: markLabel
  });
  if (port) {
    try {
      const writer = port.writable.getWriter();
      const data = new Uint8Array([markCode]);
      await writer.write(data);
      writer.releaseLock();
    } catch (e) {
      // 串口发送失败，忽略
    }
  }
}

// 导出mark CSV的函数
function downloadMarkCSV() {
  if (markRecords.length === 0) return;
  let csv = "时间,mark代码,mark说明\n";
  markRecords.forEach(rec => {
    csv += `${rec.time},${rec.code},${rec.label}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "marks.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 原有流程代码
function preload() {
  planeImg = loadImage('flight.png');
  instrImg = loadImage('flight_instr.png');
}

function setup() {
  createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  textAlign(CENTER, CENTER);
  textFont('SimHei');
  phase = "input";
  document.getElementById("download-btn").onclick = function() {
    downloadCSV();
    downloadMarkCSV();
  };
}

function draw() {
  background(255);
  if (phase === "input") {
    drawInput();
  } else if (phase === "instruction") {
    image(instrImg, 0, 0, width, height);
    drawInstructionOverlay();
  } else if (phase === "fixation") {
    drawFixation();
  } else if (phase === "trial") {
    drawTrial();
  } else if (phase === "feedback") {
    drawFeedback();
  } else if (phase === "blockRest") {
    drawBlockRest();
  } else if (phase === "finish") {
    drawFinish();
  }
}

function drawInput() {
  textSize(48);
  text("请输入信息（回车切换输入）", width/2, 150);
  textSize(36);
  fill(inputActive === "id" ? "#0080ff" : "#000");
  text("编号: " + subjectId, width/2, 350);
  fill(inputActive === "age" ? "#0080ff" : "#000");
  text("年龄: " + subjectAge, width/2, 500);
}

function drawInstructionOverlay() {
  fill(0,180);
  rect(0, height-120, width, 120);
  fill(255);
  textSize(36);
  text("按空格键进入实验", width/2, height-60);
}

function drawFixation() {
  fill(0);
  ellipse(width/2, height/2, 10, 10);
  // fixationTimer 控制显示时间
  if (millis() - fixationTimer > 500) {
    startTrial();
  }
}

function drawTrial() {
  for (let plane of trialPlanes) {
    imageMode(CENTER);
    push();
    translate(plane.x, plane.y);
    rotate(plane.angle);
    image(planeImg, 0, 0, 60, 60);
    pop();

    // 位置更新
    plane.x += plane.speed * cos(plane.flight_direction);
    plane.y += plane.speed * sin(plane.flight_direction);
  }
  // 超时判断
  if (!responded && millis() - trialStart > blockParams[currentBlock].duration) {
    recordTrial(null);
  }
}

function drawFeedback() {
  textSize(48);
  fill(correct ? "#008040" : "#D00000");
  text(correct ? "反应正确" : "反应错误", width/2, height/2);
  if (millis() - feedbackTimer > 500) {
    nextTrial();
  }
}

function drawBlockRest() {
  textSize(48);
  let names = ["第一", "第二", "第三"];
  if (currentBlock === 1) text("实验的第一阶段结束，请休息。\n按空格键继续", width/2, height/2);
  else if (currentBlock === 2) text("实验的第二阶段结束，请休息。\n按空格键继续", width/2, height/2);
  else text("实验阶段结束，按空格进入结果", width/2, height/2);
}

function drawFinish() {
  textSize(48);
  text("实验结束", width/2, height/2);
  document.getElementById("download-btn").style.display = "block";
}

// 键盘事件
function keyTyped() {
  if (phase === "input") {
    if (keyCode === ENTER) {
      if (inputActive === "id" && subjectId.length > 0) inputActive = "age";
      else if (inputActive === "age" && subjectAge.length > 0) phase = "instruction";
    } else if (keyCode === BACKSPACE) {
      if (inputActive === "id") subjectId = subjectId.slice(0,-1);
      else if (inputActive === "age") subjectAge = subjectAge.slice(0,-1);
    } else if (key.length === 1 && key.match(/[\u4e00-\u9fa5a-zA-Z0-9]/)) {
      if (inputActive === "id") subjectId += key;
      else if (inputActive === "age") subjectAge += key;
    }
  } else if (phase === "instruction" || phase === "blockRest") {
    if (key === ' ') {
      if (phase === "instruction") {
        // 在实验正式开始前弹窗连接串口（用户选COM3）
        connectSerial();
        currentBlock = 0;
        trialIdx = 0;
        blockResults = [];
        phase = "fixation";
        fixationTimer = millis();
        autoMark(81, '实验开始');
      } else if (phase === "blockRest") {
        currentBlock++;
        trialIdx = 0;
        blockResults = [];
        phase = "fixation";
        fixationTimer = millis();
        // 根据实验阶段自动mark
        if (currentBlock === 1) autoMark(1, '简单开始');
        if (currentBlock === 2) autoMark(3, '中等开始');
        if (currentBlock === 3) autoMark(5, '困难开始');
      }
    }
  } else if (phase === "trial" && !responded) {
    if (key === 'f' || key === 'j') {
      recordTrial(key);
    }
  }
}

// 启动一个trial
function startTrial() {
  responded = false;
  responseKey = null;
  rt = null;
  correct = null;
  correctResponse = null;
  error = null;

  let params = blockParams[currentBlock];
  let hasNorth = (trialIdx < params.num_trials/2);
  let planes = [];
  for (let i=0; i<params.num_planes; i++) {
    let x = random(50, width-50);
    let y = random(50, height-50);
    let angle_deg;
    if (hasNorth && i==0) angle_deg = 270;
    else {
      angle_deg = random(0,360);
      if (!hasNorth)
        while (angle_deg >= 265 && angle_deg <= 275) angle_deg = random(0,360);
    }
    let heading_deviation = random(-90, 90);
    let flight_direction_deg = angle_deg + heading_deviation;
    let angle_rad = radians(angle_deg);
    let flight_direction_rad = radians(flight_direction_deg);
    planes.push({
      x:x, y:y, angle:angle_rad, flight_direction:flight_direction_rad, speed:params.speed
    });
  }
  trialPlanes = planes;
  trialStart = millis();
  phase = "trial";
}

// 记录并反馈
function recordTrial(key) {
  responded = true;
  responseKey = key;
  rt = millis() - trialStart;
  let params = blockParams[currentBlock];
  let hasNorth = (trialIdx < params.num_trials/2);
  correctResponse = hasNorth ? 'f' : 'j';
  correct = (key === correctResponse);
  error = key ? (key !== correctResponse ? 1 : 0) : 1;

  blockResults.push({
    subjectId, subjectAge, stage:params.name, hasNorthPlane:hasNorth, response:key, rt, correct, correctResponse, error
  });

  if (params.practice) {
    feedbackTimer = millis();
    phase = "feedback";
  } else {
    nextTrial();
  }
}

// 下一个trial/阶段
function nextTrial() {
  let params = blockParams[currentBlock];
  trialIdx++;
  if (trialIdx < params.num_trials) {
    phase = "fixation";
    fixationTimer = millis();
  } else {
    results = results.concat(blockResults);
    // 自动mark阶段结束
    if (currentBlock === 1) autoMark(2, '简单结束');
    if (currentBlock === 2) autoMark(4, '中等结束');
    if (currentBlock === 3) autoMark(6, '困难结束');
    if (currentBlock < blockParams.length-1) {
      phase = "blockRest";
    } else {
      phase = "finish";
    }
  }
}

// 下载CSV（实验数据+mark记录）
function downloadCSV() {
  let timestamp = nf(year(),4)+nf(month(),2)+nf(day(),2)+"_"+nf(hour(),2)+nf(minute(),2)+nf(second(),2);
  let filename = `飞行方向判断实验_${subjectId}_${timestamp}.csv`;
  let content = "被试ID,年龄,实验阶段,是否有正北飞机,反应键,反应时(ms),是否正确,正确反应,错误\n";
  for (let r of results) {
    content += `${r.subjectId},${r.subjectAge},${r.stage},${r.hasNorthPlane},${r.response},${r.rt},${r.correct},${r.correctResponse},${r.error}\n`;
  }
  let blob = new Blob([content], {type:'text/csv'});
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
