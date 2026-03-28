const fs = require('fs');
const words = JSON.parse(fs.readFileSync('words.json', 'utf8'));

const batch = [
  // A2 - Step 1: Duygular ve Ruh Halleri
  {tr: 'Öfkeli', uz: 'G\'azablangan', ex: 'Trafik yüzünden çok öfkeliydi.', step: 1},
  {tr: 'Kıskanç', uz: 'Hasadgo\'y', ex: 'Arkadaşının başarısına kıskançlık gösterdi.', step: 1},
  {tr: 'Cömert', uz: 'Saxovatli', ex: 'O kadar cömert ki her şeyini paylaşır.', step: 1},
  {tr: 'Cimri', uz: 'Xasis', ex: 'Cimri insanlar paylaşmayı sevmezler.', step: 1},
  {tr: 'Yalnız', uz: 'Yolg\'iz', ex: 'Hafta sonları kendimi yalnız hissediyorum.', step: 1},
  {tr: 'Neşeli', uz: 'Quvnoq', ex: 'Çocukların neşeli sesleri bahçeden geliyordu.', step: 1},
  {tr: 'Endişeli', uz: 'Xavotirda', ex: 'Sınav sonuçları için endişeli bekliyor.', step: 1},
  {tr: 'Umutlu', uz: 'Umidvor', ex: 'Gelecek hakkında hep umutlu olmalıyız.', step: 1},
  {tr: 'Hayal kırıklığı', uz: 'Umid uzilishi', ex: 'Film bende büyük bir hayal kırıklığı yarattı.', step: 1},
  {tr: 'İnatçı', uz: 'O\'jar', ex: 'İnadından asla vazgeçmeyen bir çocuktu.', step: 1},
  {tr: 'Sabırlı', uz: 'Sabr-toqatli', ex: 'Öğretmenimiz çok sabırlı bir insandır.', step: 1},
  {tr: 'Utangaç', uz: 'Uyalchoq', ex: 'Yeni insanlarla tanışırken utangaç davranır.', step: 1},
  {tr: 'Özgüven', uz: 'O\'ziga ishonch', ex: 'Topluluk önünde konuşmak özgüven ister.', step: 1},
  {tr: 'Sıradan', uz: 'Oddiy', ex: 'Sıradan bir gün geçirdik.', step: 1},
  {tr: 'Özel', uz: 'Maxsus', ex: 'Bugün bizim için çok özel bir gün.', step: 1},
  {tr: 'Heyecan', uz: 'Hayajon', ex: 'Düğün hazırlıkları büyük bir heyecanla devam ediyor.', step: 1},
  {tr: 'Korku', uz: 'Qo\'rqinch', ex: 'Karanlıktan korkmak çocukça bir duygudur.', step: 1},
  {tr: 'Şaşkınlık', uz: 'Hayron qolish', ex: 'Yüzündeki şaşkınlık her şeyi anlatıyordu.', step: 1},
  {tr: 'Özlem', uz: 'Sog\'inch', ex: 'Memleketime karşı büyük bir özlem duyuyorum.', step: 1},
  {tr: 'Sıkıntı', uz: 'Qiyinchilik (Siqilish)', ex: 'Maddi sıkıntılarımızı yavaş yavaş aşıyoruz.', step: 1},
  {tr: 'Huzur', uz: 'Hotirjamlik', ex: 'Deniz kenarı insana huzur verir.', step: 1},
  {tr: 'Zevk', uz: 'Lazzat', ex: 'Kitap okumaktan büyük zevk alırım.', step: 1},
  {tr: 'Nefret', uz: 'Nafrat', ex: 'Nefret duygusu kalbi kirletir.', step: 1},
  {tr: 'Sevgi', uz: 'Sevgi', ex: 'Sevgi her zaman kazanır.', step: 1},
  {tr: 'Güven', uz: 'Ishonch', ex: 'Arkadaşlıkta güven en önemli temeldir.', step: 1},

  // A2 - Step 2: Seyahat ve Macera
  {tr: 'Keşfetmek', uz: 'Kashf qilmoq', ex: 'Yeni yerler keşfetmeyi çok severim.', step: 2},
  {tr: 'Konaklamak', uz: 'Joylashmoq', ex: 'Dağ evinde bir gece konakladık.', step: 2},
  {tr: 'Manzara', uz: 'Manzara', ex: 'Odanın penceresinden harika bir deniz manzarası var.', step: 2},
  {tr: 'Rehber', uz: 'Gid', ex: 'Rehberimiz bize antik kenti gezdirdi.', step: 2},
  {tr: 'Rota', uz: 'Yo\'nalish', ex: 'Yolculuk rotamızı haritadan belirledik.', step: 2},
  {tr: 'Valiz', uz: 'Chamadon', ex: 'Valizimi dün akşamdan hazırladım.', step: 2},
  {tr: 'Uçak', uz: 'Samolyot', ex: 'Uçakla İstanbul\'a iki saatte gittik.', step: 2},
  {tr: 'Havalimanı', uz: 'Aeroport', ex: 'Havalimanında bilet kontrolünden geçtik.', step: 2},
  {tr: 'Pasaport', uz: 'Pasport', ex: 'Yurt dışı seyahati için pasaport şart.', step: 2},
  {tr: 'Vize', uz: 'Viza', ex: 'Avrupa seyahati için vize almam gerekiyor.', step: 2},
  {tr: 'Bilet', uz: 'Chipta', ex: 'Konser biletlerini internetten aldık.', step: 2},
  {tr: 'Tren', uz: 'Poyezd', ex: 'Gece treniyle yolculuk yapmak çok romantik.', step: 2},
  {tr: 'Otobüs', uz: 'Avtobus', ex: 'Otobüs terminaline taksiyle gittik.', step: 2},
  {tr: 'Gemi', uz: 'Kema', ex: 'Boğazda bir tur gemisine bindik.', step: 2},
  {tr: 'Turist', uz: 'Sayyoh', ex: 'Yazın bu şehir turist akınına uğrar.', step: 2},
  {tr: 'Yerel', uz: 'Mahalliy', ex: 'Yerel yemeklerin tadına mutlaka bakmalısın.', step: 2},
  {tr: 'Yurt dışı', uz: 'Chet el', ex: 'Eğitimim için yurt dışına gitmek istiyorum.', step: 2},
  {tr: 'Müze', uz: 'Muzey', ex: 'Tarih müzesini rehber eşliğinde gezdik.', step: 2},
  {tr: 'Sergi', uz: 'Ko\'rgazma', ex: 'Modern sanat sergisini ziyaret ettik.', step: 2},
  {tr: 'Anı', uz: 'Xotira', ex: 'Bu tatilden unutulmaz anılarla döndük.', step: 2},
  {tr: 'Gezgin', uz: 'Sayyoh (Sayohat qiluvchi)', ex: 'Bir gezgin olarak dünyayı dolaşıyor.', step: 2},
  {tr: 'Harita', uz: 'Xarita', ex: 'Yolu bulmak için haritayı kullandık.', step: 2},
  {tr: 'Hediyelik', uz: 'Sovg\'abop', ex: 'Arkadaşlarım için hediyelik eşya aldım.', step: 2},
  {tr: 'Kamp', uz: 'Lager', ex: 'Doğada kamp kurup yıldızları izledik.', step: 2},
  {tr: 'Piknik', uz: 'Piknik', ex: 'Pazar günü ailece nehir kenarında piknik yaptık.', step: 2}
];

batch.forEach((item, index) => {
  words.push({
    id: `a2-s${item.step}-${index}`,
    tr: item.tr,
    uz: item.uz,
    example: item.example,
    level: 'A2',
    step: item.step
  });
});

fs.writeFileSync('words.json', JSON.stringify(words, null, 2));
console.log('A2 Steps 1-2 Added Successfully');
