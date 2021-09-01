// ページの初期化
(function init() {
    let createButton = document.getElementById("createButton")
    createButton.addEventListener("click", { eventType: "create", handleEvent: connect })
    dispRoom()
    document.getElementById("refresh").onclick = dispRoom
}())

// ビデオ通話接続処理
async function connect(e) {
    let roomId
    if (e.currentTarget) {
        roomId = e.currentTarget.value
    } else {
        roomId = null
    }

    // カメラとマイクを取得
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(window.alert)
    document.getElementById('localVideo').srcObject = stream

    // PeerConnectionを作成
    let pc = new RTCPeerConnection()

    // PeerConnectionにTrackを追加
    stream.getTracks().forEach(track => {
        console.log("add track: " + track)
        pc.addTrack(track, stream)
    })

    // Trackが追加された時のハンドラ
    // VideoTrackが追加された時にVideoエレメントを生成する
    pc.ontrack = function (event) {
        console.log("ontrack")
        if (event.track.kind === 'audio') {
            return
        }

        let el = document.createElement(event.track.kind)
        el.srcObject = event.streams[0]
        el.autoplay = true
        el.controls = true
        el.classList.add("remoteVideo")
        document.getElementById('remoteVideos').appendChild(el)

        event.track.onmute = () => {
            el.play()
        }

        event.streams[0].onremovetrack = () => {
            if (el.parentNode) {
                el.parentNode.removeChild(el)
            }
        }
    }

    // ICECandidateを送信
    pc.onicecandidate = function (event) {
        ws.send(JSON.stringify({ event: "candidate", data: JSON.stringify(event.candidate.toJSON()) }))
    }

    // WebSocketの作成
    let addr = document.getElementById("address")
    let ws = new WebSocket("ws://" + addr.value + "/ws")

    // WebSocketが接続できた時のハンドラ
    // WebSocketの接続を確認してからメッセージを送信する
    ws.onopen = () => {
        console.log(this.eventType + ": " + roomId)
        ws.send(JSON.stringify({ event: this.eventType, data: roomId }))
    }

    // WebSocketが切断されたときのハンドラ
    // PeerConnectionを閉じてVideoエレメントを削除する
    ws.onclose = function (event) {
        window.alert("connection closed")
        pc.close()
        stream.getTracks().forEach(t => t.stop())
        let remoteVideo = document.getElementById("remoteVideos")
        let elm = remoteVideo.cloneNode(false)
        remoteVideo.parentElement.replaceChild(elm, remoteVideo)

        let localVideo = document.getElementById("localVideo")
        elm = localVideo.cloneNode(false)
        localVideo.parentElement.replaceChild(elm, localVideo)
    }

    // WebSocketがメッセージを受け取った時のハンドラ
    // SDPOfferを受け取ったらSDPAnswerを返してICECandidateの交換をする
    ws.onmessage = function (event) {
        console.log(JSON.parse(event.data))
        let msg = JSON.parse(event.data)
        if (!msg) {
            return console.log('faild to parse answer')
        }

        switch (msg.event) {
            case 'offer':
                console.log("offer arrived")
                let offer = JSON.parse(msg.data)
                if (!offer) {
                    return console.log('failed to parse answer')
                }
                pc.setRemoteDescription(offer)
                pc.createAnswer().then(answer => {
                    console.log("create Answer")
                    pc.setLocalDescription(answer)
                    ws.send(JSON.stringify({ event: 'answer', data: JSON.stringify(answer) }))
                })
                return

            case 'candidate':
                let candidate = JSON.parse(msg.data)
                if (!candidate) {
                    return console.log('failed to parse candidate')
                }

                pc.addIceCandidate(candidate)
        }
    }

    // WebSocketがエラーを起こしたときのハンドラ
    ws.onerror = function (event) {
        console.log("ERROR: " + event.data)
    }

    // 切断ボタンにイベントを登録する
    document.getElementById("closeButton").onclick = () => {
        ws.send(JSON.stringify({ event: "close", data: "" }))
    }
}

// 部屋一覧の更新
async function dispRoom() {
    let roomlist = document.getElementById("roomlist")
    let elm = roomlist.cloneNode(false)

    let res = await getRoomList()

    Object.keys(res).forEach((key) => {
        let roomRow = document.createElement("div")
        roomRow.classList.add("roomRow")

        let roomID = document.createElement("p")
        roomID.classList.add("roomID")
        roomID.innerText = res[key]
        roomRow.appendChild(roomID)

        let connectionButton = document.createElement("button")
        connectionButton.classList.add("connectionButton")
        connectionButton.value = res[key]
        connectionButton.innerText = '接続'
        connectionButton.addEventListener("click", { eventType: "join", handleEvent: connect })
        roomRow.appendChild(connectionButton)

        elm.appendChild(roomRow)
    })

    roomlist.parentNode.replaceChild(elm, roomlist)
}

// サーバに部屋一覧を問い合わせて結果をJsonで返す
async function getRoomList() {
    let addr = document.getElementById("address")
    let response = await fetch("https://" + addr.value + '/list')
    return response.json()
}