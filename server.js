// ============================================================
//  Lacoste Skor Tablosu — sunucu
//  iPad'den skor girilir, 43" ekranda ilk 5 canlı güncellenir,
//  iPad butonu büyük ekrandan müzik çalar.
//
//  Mimari:  iPad (inputScreen)  ⇄  bu sunucu (Socket.io)  ⇄  Büyük ekran (boardScreen)
//  Gerçek zamanlı iletişim Socket.io olayları ile yapılır.
// ============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);   // Express'i HTTP sunucusuna sarıp...
const io = new Server(server);           // ...aynı sunucu üzerinde Socket.io'yu çalıştırıyoruz.

// Port'u sabit yazmıyoruz: deploy ortamı (Forge/pm2) PORT'u kendisi verir.
const PORT = process.env.PORT || 8080;//
// /reset yıkıcı bir işlem (tüm skorları siler). Açık internette korumasız kalmasın diye
// opsiyonel bir anahtar: ADMIN_KEY tanımlıysa ?key=... doğru gelmeden çalışmaz.
const ADMIN = process.env.ADMIN || "";

// public/ klasöründeki dosyaları (html, görseller, ses) statik olarak servis et.
app.use(express.static(__dirname + "/public"));

// Kök adrese gelen büyük ekran tablosuna yönlensin.
app.get("/", (req, res) => res.redirect("/boardScreen.html"));

// Skorlar bellekte tutulur. NOT: sunucu yeniden başlarsa sıfırlanır.
// Tek günlük etkinlik için yeterli; kalıcılık gerekirse veritabanı eklenir.
let scores = [];

app.get("/reset", (req, res) => {
    if (ADMIN && req.query.key !== ADMIN) {
        return res.status(403).send("forbidden");
    }
    scores = [];
    io.emit("currentTop5", []);   // tüm bağlı ekranlara "liste boşaldı" de
    res.send("reset ok");
});

// Skorları yüksekten düşüğe sıralayıp ilk 5'i döndürür.
function getTop5() {
    return [...scores]               // kopya üzerinde sırala (orijinali bozma)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
}

// Bir cihaz (iPad veya ekran) bağlandığında:
io.on("connection", (socket) => {
    // iPad yeni skor gönderdi
    socket.on("newScore", (data) => {
        // Gelen veriye asla körü körüne güvenme: geçersiz skoru yok say.
        if (!data || typeof data.score !== "number" || Number.isNaN(data.score)) {
            return;
        }
        scores.push({
            name: String(data.name || "").slice(0, 50),     // uzunluğu sınırla
            surname: String(data.surname || "").slice(0, 50),
            score: data.score,
            phone: String(data.phone || "").slice(0, 20)
        });
        io.emit("currentTop5", getTop5());  // herkese güncel ilk 5'i yayınla
    });

    // iPad müzik butonuna bastı → sesi tüm ekranlara ilet (büyük ekran çalar)
    socket.on("playSound", () => {
        io.emit("playSound");
    });

    // Büyük ekran açılırken güncel listeyi istedi → sadece ona gönder
    socket.on("getTop5", () => {
        socket.emit("currentTop5", getTop5());
    });

    // Bağlanır bağlanmaz mevcut durumu gönder (boş ekran kalmasın)
    socket.emit("currentTop5", getTop5());
});

server.listen(PORT, () => {
    console.log("Listening on port " + PORT);
});
