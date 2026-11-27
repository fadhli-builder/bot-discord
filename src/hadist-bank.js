// Bank konten "One Day One Hadith" — dikurasi manual, BUKAN dari web/LLM saat runtime.
// ATURAN KUALITAS (permintaan Bos 2026-11-06):
// - Hadits HANYA dari Shahihain (Bukhari & Muslim) = otomatis shahih menurut ijma ulama,
//   atau hadits lain yang telah DISHAHIHKAN Syaikh Al-Albani (ditulis di field sumber).
// - Hadits dhoif/palsu/populer-tapi-dhoif (hubbul wathan, bersih sebagian iman, dll) TIDAK dimasukkan.
// - Pepatah sahabat (atsar) jenisnya TERPISAH ('atsar') dan TIDAK boleh dilabel hadits.
// - Nomor hadits hanya ditulis kalau yakin (pengikutan edisi standar); kalau ragu, cukup nama kitab.
// Field: jenis ('hadis'|'dua'|'atsar'), arab (opsional), terjemah, sumber.

module.exports = [
  {
    jenis: "hadis",
    arab: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
    terjemah: "Sesungguhnya setiap amal tergantung pada niatnya, dan setiap orang (akan dibalas) sesuai dengan apa yang ia niatkan.",
    sumber: "HR. Bukhari no. 1 & Muslim no. 1907",
  },
  {
    jenis: "hadis",
    arab: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ",
    terjemah: "Seorang muslim adalah orang yang kaum muslimin selamat dari gangguan lisannya dan tangannya.",
    sumber: "HR. Bukhari no. 10",
  },
  {
    jenis: "hadis",
    arab: "أَحَبُّ الأَعْمَالِ إِلَى اللهِ أَدْوَمُهَا وَإِنْ قَلَّ",
    terjemah: "Amal yang paling Allah cintai adalah yang paling kontinu (dilakukan terus), walaupun sedikit.",
    sumber: "HR. Bukhari no. 6464",
  },
  {
    jenis: "hadis",
    arab: "أَنَّ الدِّينَ يُسْرٌ، وَلَنْ يُغَالِبَ عَلَى الدِّينِ أَحَدٌ إِلاَّ غَالَبَهُ",
    terjemah: "Agama (perintah Allah) itu mudah; tidak seorang pun memberatkan dirinya dalam beragama melainkan agama itu akan mengalahkannya. Maka bersikaplah lurus, seimbanglah (dalam beribadah), dan sambailah (ibadah) di pagi, sore, dan sebagian malam.",
    sumber: "HR. Bukhari no. 39",
  },
  {
    jenis: "hadis",
    arab: "الْدِّينُ النَّصِيحَةُ",
    terjemah: "Agama ini adalah (tuntunan) nasihat — untuk Allah, kitab-Nya, Rasul-Nya, pemimpin muslimin, dan kaum muslimin pada umumnya.",
    sumber: "HR. Muslim no. 55",
  },
  {
    jenis: "hadis",
    arab: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    terjemah: "Tidak sempurna iman salah seorang di antara kalian hingga ia mencintai untuk saudaranya sebagaimana ia mencintai untuk dirinya sendiri.",
    sumber: "HR. Bukhari no. 13",
  },
  {
    jenis: "hadis",
    arab: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    terjemah: "Sebaik-baik kalian adalah orang yang mempelajari Al-Qur'an dan mengajarkannya.",
    sumber: "HR. Bukhari no. 5027",
  },
  {
    jenis: "hadis",
    arab: "سُبْحَانَ اللهِ وَبِحَمْدِهِ، سُبْحَانَ اللهِ الْعَظِيمِ",
    terjemah: "Dua kalimat yang ringan di atas lisannya, berat di timbangan kebaikan, yang dicintai oleh Ar-Rahman: Mahasuci Allah dan segala puji bagi-Nya, Mahasuci Allah Yang Mahaagung.",
    sumber: "HR. Bukhari no. 6682 & Muslim no. 2694",
  },
  {
    jenis: "hadis",
    arab: "لَا تَغْضَبْ",
    terjemah: "(Seorang bertanya berulang kali, Rasulullah bersabda tiga kali:) Janganlah engkau marah.",
    sumber: "HR. Bukhari no. 6116",
  },
  {
    jenis: "hadis",
    arab: "لَيْسَ الْغِنَى عَنْ كَثْرَةِ الْعَرَضِ، وَلَكِنَّ الْغِنَى غِنَى النَّفْسِ",
    terjemah: "Bukanlah kaya itu karena banyaknya harta, tetapi hakikat kaya adalah kaya jiwa (rasa cukup).",
    sumber: "HR. Bukhari no. 6446",
  },
  {
    jenis: "hadis",
    arab: "يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا",
    terjemah: "Mudah-mudahlah dan jangan memberatkan, gembirakanlah (berilah kabar baik) dan jangan menjauhkan (orang dari kebaikan).",
    sumber: "HR. Bukhari no. 69",
  },
  {
    jenis: "hadis",
    arab: "إِنَّ اللهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ، وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ",
    terjemah: "Sesungguhnya Allah tidak melihat rupa dan harta kalian, tetapi Allah melihat hati dan amal kalian.",
    sumber: "HR. Muslim no. 2564",
  },
  {
    jenis: "hadis",
    arab: "الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ، وَفِي كُلٍّ خَيْرٌ؛ اِحْرَصْ عَلَى مَا يَنْفَعُكَ، وَاسْتَعِنْ بِاللهِ وَلَا تَعْجِزْ",
    terjemah: "Mukmin yang kuat lebih baik dan lebih dicintai Allah daripada mukmin yang lemah — dan pada masing-masing ada kebaikan. Pedulikanlah apa yang memberi manfaat bagimu, mohonlah pertolongan kepada Allah, dan jangan engkau lemah (putus asa).",
    sumber: "HR. Muslim no. 2664",
  },
  {
    jenis: "hadis",
    arab: "مَنْ سَلَكَ طَرِيقًا يَطْلُبُ فِيهِ عِلْمًا سَلَكَ اللهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
    terjemah: "Barangsiapa menempuh jalan untuk mencari ilmu, Allah akan memudahkan baginya jalan menuju surga.",
    sumber: "HR. Muslim no. 2699",
  },
  {
    jenis: "hadis",
    arab: "مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا نَفَّسَ اللهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ، وَمَنْ يَسَّرَ عَلَى مُعْتَسِرٍ يَسَّرَ اللهُ عَلَيْهِ فِي الدُّنْيَا وَالْآخِرَةِ",
    terjemah: "Barangsiapa meringankan kesulitan seorang mukmin dari kesulitan-kesulitan dunia, Allah akan meringankan salah satu kesulitannya di hari kiamat. Barangsiapa memudahkan orang yang dalam kesempitan, Allah akan memudahkannya di dunia dan akhirat.",
    sumber: "HR. Muslim no. 2699",
  },
  {
    jenis: "hadis",
    arab: "اتَّقِ اللهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ",
    terjemah: "Bertakwalah kepada Allah di mana pun engkau berada, susulilah keburukan dengan kebaikan maka ia akan menghapusnya, dan bergaulah dengan manusia dengan akhlak yang baik.",
    sumber: "HR. Tirmidzi no. 1987, dishahihkan Al-Albani",
  },
  {
    jenis: "hadis",
    arab: "مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ",
    terjemah: "Termasuk kesempurnaan keislaman seseorang adalah meninggalkan urusan yang tidak ada kaitannya dengan dirinya.",
    sumber: "HR. Tirmidzi no. 2317, dishahihkan Al-Albani",
  },
  {
    jenis: "hadis",
    arab: "مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ",
    terjemah: "Barangsiapa menunjukkan suatu kebaikan (kepada orang lain), maka baginya pahala seperti pahala orang yang mengerjakannya — tanpa dikurangi sedikit pun.",
    sumber: "HR. Muslim no. 1893",
  },
  {
    jenis: "hadis",
    arab: "إِيَّاكُمْ وَالظَّنَّ، فَإِنَّ الظَّنَّ أَكْذَبُ الْحَدِيثِ",
    terjemah: "Awaslah kalian dari prasangka, karena prasangka adalah perkataan yang paling dusta. Jangan mencari-cari kesalahan orang lain, jangan mengintip-intip aib orang, jangan saling dengki, jangan saling benci, dan jadilah hamba-hamba Allah bersaudara.",
    sumber: "HR. Bukhari no. 6064",
  },
  {
    jenis: "hadis",
    arab: "عَجَبًا لِأَمْرِ الْمُؤْمِنِ، إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ، وَلَيْسَ ذَاكَ لِأَحَدٍ إِلَّا لِلْمُؤْمِنِ: إِنْ أَصَابَتْهُ سَرَّاءُ شَكَرَ فَكَانَ خَيْرًا لَهُ، وَإِنْ أَصَابَتْهُ ضَرَّاءُ صَبَرَ فَكَانَ خَيْرًا لَهُ",
    terjemah: "Sungguh menakjubkan urusan orang mukmin, seluruh urusannya adalah kebaikan baginya: jika mendapat kesenangan ia bersyukur, itu baik baginya; jika tertimpa musibah ia bersabar, itu pun baik baginya.",
    sumber: "HR. Muslim no. 2999",
  },
  {
    jenis: "hadis",
    arab: "اتَّقُوا الظُّلْمَ، فَإِنَّ الظُّلْمَ ظُلُمَاتٌ يَوْمَ الْقِيَامَةِ",
    terjemah: "Awaslah kalian dari perbuatan zalim, karena kezaliman akan menjadi kegelapan (gelap gulita) pada hari kiamat.",
    sumber: "HR. Bukhari no. 2447 & Muslim no. 2578",
  },
  {
    jenis: "hadis",
    arab: "تَهَادُوا تَحَابُّوا",
    terjemah: "Bertukarlah hadiah, niscaya kalian saling mencintai.",
    sumber: "HR. Tirmidzi no. 2960, dishahihkan Al-Albani",
  },
  {
    jenis: "hadis",
    arab: "عُودُوا الْمَرِيضَ، وَأَطْعِمُوا الْجَائِعَ، وَفُكُّوا الْعَانِيَ",
    terjemah: "Jenguklah orang sakit, berilah makan orang yang lapar, dan bebaskanlah orang yang tertawan (tertimpa kesulitan).",
    sumber: "HR. Bukhari no. 5649",
  },
  {
    jenis: "hadis",
    arab: "الدُّنْيَا سِجْنُ الْمُؤْمِنِ وَجَنَّةُ الْكَافِرِ",
    terjemah: "Dunia ini adalah penjara bagi orang mukmin dan surga bagi orang kafir.",
    sumber: "HR. Muslim no. 2956",
  },
  {
    jenis: "hadis",
    arab: "انْظُرُوا إِلَى مَنْ أَسْفَلَ مِنْكُمْ وَلَا تَنْظُرُوا إِلَى مَنْ هُوَ فَوْقَكُمْ، فَهُوَ أَجْدَرُ أَنْ لَا تَزْدَرُوا نِعْمَةَ اللهِ عَلَيْكُمْ",
    terjemah: "Lihatlah orang yang berada di bawah kalian (dalam urusan dunia) dan jangan melihat orang yang di atas kalian — hal itu lebih layak agar kalian tidak meremehkan nikmat Allah yang telah diberikan kepada kalian.",
    sumber: "HR. Bukhari no. 6490",
  },
  {
    jenis: "hadis",
    arab: "مَا مِنْ يَوْمٍ يُصْبِحُ الْعِبَادُ فِيهِ إِلَّا مَلَكَانِ يَنْزِلَانِ، فَيَقُولُ أَحَدُهُمَا: اللَّهُمَّ أَعْطِ مُنْفِقًا خَلَفًا، وَيَقُولُ الْآخَرُ: اللَّهُمَّ أَعْطِ مُمْسِكًا تَلَفًا",
    terjemah: "Tidak ada hari pagi yang dijalani hamba-hamba Allah kecuali turunlah dua malaikat: salah satunya berdoa, Ya Allah berilah ganti bagi orang yang berinfak; dan yang lain berdoa, Ya Allah binasakanlah harta orang yang menahan infaknya.",
    sumber: "HR. Bukhari no. 1442",
  },
  {
    jenis: "hadis",
    arab: "الْمَرْءُ مَعَ مَنْ أَحَبَّ",
    terjemah: "Seseorang akan bersama (di surga nanti bersama) orang yang ia cintai.",
    sumber: "HR. Bukhari no. 6168",
  },
  {
    jenis: "hadis",
    arab: "إِنَّ اللهَ رَفِيقٌ يُحِبُّ الرِّفْقَ فِي الْأَمْرِ كُلِّهِ",
    terjemah: "Sesungguhnya Allah itu lembut, dan Dia mencintai kelembutan dalam segala urusan.",
    sumber: "HR. Muslim no. 2672",
  },
  {
    jenis: "hadis",
    arab: "الصَّبْرُ ضَوْءٌ",
    terjemah: "Sabar itu cahaya — dan bersyukur itu (tanda) kemuliaan hati.",
    sumber: "HR. Muslim no. 223",
  },
  {
    jenis: "hadis",
    arab: "الطُّهُورُ شَطْرُ الْإِيمَانِ",
    terjemah: "Suci (bersuci) itu separuh iman.",
    sumber: "HR. Muslim no. 223",
  },
  {
    jenis: "hadis",
    arab: "إِنَّ فِي الْجَسَدِ مُضْغَةً إِذَا صَلَحَتْ صَلَحَ الْجَسَدُ كُلُّهُ، وَإِذَا فَسَدَتْ فَسَدَ الْجَسَدُ كُلُّهُ، أَلَا وَهِيَ الْقَلْبُ",
    terjemah: "Sungguh di dalam tubuh manusia ada segumpal daging: apabila ia baik, baiklah seluruh tubuh; dan apabila ia rusak, rusaklah seluruh tubuh. Ketahuilah, ia adalah hati.",
    sumber: "HR. Muslim no. 1599",
  },
  {
    jenis: "hadis",
    arab: "بُونِيَ بِخَمْسٍ قَبْلَ خَمْسٍ: شَبَابِكَ قَبْلَ هَرَمِكَ، وَصِحَّتِكَ قَبْلَ سَقَمِكَ، وَغِنَاكَ قَبْلَ فَقْرِكَ، وَفَرَاغِكَ قَبْلَ شُغْلِكَ، وَحَيَاتِكَ قَبْلَ مَوْتِكَ",
    terjemah: "Manfaatkanlah lima perkara sebelum datang lima perkara (lain): masa mudamu sebelum datang masa tuamu, masa sehatmu sebelum datang masa sakitmu, masa kayamu sebelum datang masa fakirmu, masa luangmu sebelum datang masa sibukmu, dan hidupmu sebelum datang kematianmu.",
    sumber: "HR. Hakim no. 7846, dishahihkan Al-Albani",
  },
  {
    jenis: "hadis",
    arab: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ",
    terjemah: "Senyummu di wajah saudaramu adalah sedekah bagimu.",
    sumber: "HR. Tirmidzi no. 1956, dishahihkan Al-Albani",
  },
  {
    jenis: "hadis",
    arab: "إِنَّ اللهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلًا أَنْ يُتْقِنَهُ",
    terjemah: "Sesungguhnya Allah mencintai apabila salah seorang kalian mengerjakan suatu pekerjaan, ia menyempurnakannya (mengerjakannya dengan baik dan penuh kesungguhan).",
    sumber: "HR. Thabrani & Baihaqi, dishahihkan Al-Albani",
  },
  {
    jenis: "hadis",
    arab: "خِيَارُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ",
    terjemah: "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lain.",
    sumber: "HR. Thabrani, dishahihkan Al-Albani (Silsilah Ash-Shahihah no. 906)",
  },
  {
    jenis: "hadis",
    arab: "مَنْ لَا يَشْكُرِ النَّاسَ لَا يَشْكُرِ اللهَ",
    terjemah: "Barangsiapa tidak bersyukur kepada manusia, maka (tidak pula) ia bersyukur kepada Allah.",
    sumber: "HR. Bukhari no. 6172 & Tirmidzi, dishahihkan Al-Albani",
  },
  {
    jenis: "hadis",
    arab: "الدُّعَاءُ هُوَ الْعِبَادَةُ",
    terjemah: "Doa itu adalah inti dari ibadah.",
    sumber: "HR. Tirmidzi no. 2969, dishahihkan Al-Albani",
  },
  {
    jenis: "dua",
    arab: "يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ",
    terjemah: "Ya Allah, Wahai Zat Yang Maha Memalingkan hati, teguhkanlah hatiku di atas agama-Mu.",
    sumber: "HR. Tirmidzi no. 2140, dishahihkan Al-Albani",
  },
  {
    jenis: "dua",
    arab: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    terjemah: "Kami memasuki waktu pagi dan kerajaan hanya milik Allah, segala puji bagi Allah. Tidak ada tuhan yang berhak disembah selain Allah, Dia Maha Esa, tidak ada sekutu bagi-Nya. Milik-Nya kerajaan dan pujian, Dia Maha Kuasa atas segala sesuatu. (Dibaca saat pagi, bagian dari dzikir pagi)",
    sumber: "HR. Abu Dawud no. 5071, dishahihkan Al-Albani",
  },
  {
    jenis: "atsar",
    arab: "حَاسِبُوا أَنْفُسَكُمْ قَبْلَ أَنْ تُحَاسَبُوا",
    terjemah: "Hitunglah amal diri kalian sebelum kalian dihisab, dan timbanglah diri kalian sebelum ditimbang — itu akan lebih ringan bagi kalian di hari hisab.",
    sumber: "Pepatah Umar bin Khattab radhiyallahu 'anhu (dikutip Imam Ahmad dalam Az-Zuhd)",
  },
  {
    jenis: "atsar",
    arab: "أَلَا إِنِّي وُلِّيتُ عَلَيْكُمْ وَلَسْتُ بِخَيْرِكُمْ، فَإِنْ أَحْسَنْتُ فَأَعِينُونِي، وَإِنْ أَسَأْتُ فَقَوِّمُونِي",
    terjemah: "Aku telah diangkat menempati urusan ini padahal aku bukan orang terbaik di antara kalian. Jika aku berbuat baik, tolonglah aku; dan jika aku bersalah, luruskanlah aku.",
    sumber: "Ucapan Abu Bakar Ash-Shiddiq radhiyallahu 'anhu saat pertama memimpin (dikutip dalam Sunan At-Tirmidzi)",
  },
  {
    jenis: "atsar",
    arab: "قِيمَةُ الْمَرْءِ مَا يُحْسِنُهُ",
    terjemah: "Nilai (kemuliaan) seseorang adalah apa yang ia kerjakan dengan baik.",
    sumber: "Pepatah Ali bin Abi Thalib radhiyallahu 'anhu",
  },
  {
    jenis: "atsar",
    arab: "الْعِلْمُ خَيْرٌ مِنَ الْمَالِ؛ الْعِلْمُ يَحْرُسُكَ وَأَنْتَ تَحْرُسُ الْمَالَ",
    terjemah: "Ilmu lebih baik daripada harta: ilmu menjagamu, sedangkan kamu yang harus menjaga harta.",
    sumber: "Pepatah Ali bin Abi Thalib radhiyallahu 'anhu",
  },
];
