const textToSpeech = require("@google-cloud/text-to-speech");

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const generateSpeech = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: "Text is Required" });
    }

    //request
    const request = {
      audioConfig: {
        audioEncoding: "LINEAR16",
        effectsProfileId: ["small-bluetooth-speaker-class-device"],
        pitch: 0,
        speakingRate: 1,
      },
      input: {
        text: text,
      },
      voice: {
        languageCode: "en-US",
        name: "en-US-Chirp3-HD-Achernar",
      },
    };
    //text to audio operation
    const [response] = await client.synthesizeSpeech(request);
    const audioContent = response.audioContent;

    //convert to base64 t osend frontend
    const audioBase64 = audioContent.toString("base64");

    //return response
    res.json({
      success: true,
      audio: audioBase64,
      format: "mp3",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message, detail: error });
  }
};
module.exports = { generateSpeech };
