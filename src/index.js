/// <reference types="@fastly/js-compute" />
/* eslint-env serviceworker */

addEventListener("fetch", event => event.respondWith(app(event)));

const INITIAL_LIVE_FRACTION = 0.2;
let board = Array.from({ length: 50 }, () => Array.from({ length: 50 }, () => false));

async function app(event) {
  let url = new URL(event.request.url)
  let params = url.searchParams
  let suppliedBoard = params.get('board')
  if (url.pathname === '/gol') {
    let id = event.request.headers.get('Last-Event-ID');
    // id = id ? huffDeGo(id) : huffDeGo(suppliedBoard)
    id = id ? id : suppliedBoard
    if (id) {
        suppliedBoard = String(id)
        suppliedBoard = suppliedBoard.match(/.{1,50}/g)
        suppliedBoard = suppliedBoard.map(a => a.match(/.{1,50}/g))
        suppliedBoard = suppliedBoard.map(a => a.flatMap(a=>a.split('')))
        board = suppliedBoard
        tick();
    } else {
      randomizeBoard();
    }
    // id = huffGo(board.map(a=>a.join('')).join(''));
    id = board.map(a=>a.join('')).join('');
    return new Response(new Response(`retry: 1\nid: ${id}\ndata: ${drawBoard()}\n\n`).body.pipeThrough(new CompressionStream("gzip")), {
      headers: {
        "Content-Type": "text/event-stream",
        'Cache-Control': 'no-cache',
        "Content-Encoding": "gzip",
      }});
  }
  if (url.pathname === '/svg') {
    // let id = huffDeGo(suppliedBoard)
    let id = suppliedBoard
    if (id) {
        suppliedBoard = String(id)
        suppliedBoard = suppliedBoard.match(/.{1,50}/g)
        suppliedBoard = suppliedBoard.map(a => a.match(/.{1,50}/g))
        suppliedBoard = suppliedBoard.map(a => a.flatMap(a=>a.split('')))
        board = suppliedBoard
        tick();
    } else {
      randomizeBoard();
    }
    id = board.map(a=>a.join('')).join('');
    return new Response(new Response(drawBoard()).body.pipeThrough(new CompressionStream("gzip")), {
      headers: {
        "Content-Type": "image/svg+xml",
        // '¿Cache-Control': 'no-cache',
        "Content-Encoding": "gzip",
        ETag: id,
        'Cache-Control': 'max-age=31536000, immutable',
        'id': id
      }});
  }
  if (suppliedBoard) {
      // suppliedBoard = String(huffDeGo(suppliedBoard))
      suppliedBoard = String(suppliedBoard)
      suppliedBoard = suppliedBoard.match(/.{1,50}/g)
      suppliedBoard = suppliedBoard.map(a => a.match(/.{1,50}/g))
      suppliedBoard = suppliedBoard.map(a => a.flatMap(a=>a.split('')))
      board = suppliedBoard
      tick();
  } else {
    randomizeBoard();
  }
  let dboard= drawBoard();
  let id = board.map(a=>a.join('')).join('');
  return new Response(`
  <!DOCTYPE html>
  <html>
    <head>
      <title>Title</title>
      <link rel="icon" href="/svg?board=${id}" type="image/svg+xml">
    </head>
    <body style="margin:0;display: grid;place-content: center;">
    ${dboard}
    <script type=module>
    let pause = false;
    document.onkeydown = function(evt) {
      let key = evt.key
      let isEscape = (key === "Escape" || key === "Esc");
      if (isEscape) {
        pause = !pause;
        if (!pause) {
          tick()
        }
      }
    };
    // var es = new EventSource("/gol?board=${id}");
    // es.addEventListener('message', ev => {
    //   document.body.innerHTML = ev.data
    // });
    let board='${id}'
    let favicon = document.querySelector('link[rel="icon"]');
    async function tick() {
      try {
        let a = new URL('/svg', window.location);
        a.search = new URLSearchParams('board='+board)
        favicon.href = a;
        const res = await fetch(a)
        board=res.headers.get('id')
        document.body.innerHTML = await res.text()
      } finally {
        if (!pause) {
          tick()
        }
      }
    }
    tick()
    </script>
    </body>
  </html>
`, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      Link: `</svg?board=${id}>; rel="icon"; type="image/svg+xml"`
    }
  });
}


function drawBoard() {
  var boardHtml = '<svg height="99vh" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">';
  for (let i=0; i <= board.length-1; i++) {
    for (let j=0; j <= board[i].length-1; j++) {
      if (board[i][j]) {
        boardHtml += `<rect id="${i}-${j}" x="${i * 10}" y="${j * 10}" width="${10}" height="${10}" style="fill:black;stroke-width:3;stroke:white" />`
      } else {
        // boardHtml += `<rect id="${i}-${j}" x="${i * 10}" y="${j * 10}" width="${10}" height="${10}" style="fill:white;stroke-width:3;stroke:white" />`
      }
    }
  }
  boardHtml += '</svg>'
  return boardHtml;
}

function mod( x,  m) {
  return (x%m + m)%m;
}

function isAlive(row, col) {
  row = mod(row, 50);
  col = mod(col, 50);
  return board.at(row).at(col) == 1;
}

function liveNighbourCount(row, col) {
  return isAlive(row - 1, col - 1) + isAlive(row - 1, col) + isAlive(row - 1, col + 1)
    + isAlive(row, col - 1) + isAlive(row, col + 1)
    + isAlive(row + 1, col - 1) + isAlive(row + 1, col) + isAlive(row + 1, col + 1);
}

function willLive(row, col) {
  var alive = isAlive(row, col);
  var neighbours = liveNighbourCount(row, col);
  return Number(neighbours === 3 || neighbours === 2 && alive);
}

function generateBoardState(liveFunc) {
  for (let i=0; i <= board.length - 1; i++) {
    for (let j=0; j <= board[i].length - 1; j++) {
      board[i][j] = liveFunc(i, j);
    }
  }
}

function tick() {
  generateBoardState(willLive);
}

function randomizeBoard() {
  generateBoardState(function () {
    return Number(Math.random() < INITIAL_LIVE_FRACTION);
  });
}
