const express = require('express');
const session = require('express-session');
const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const he = require('he');

admin.initializeApp({
  credential: admin.credential.cert('./firebase-credentials.json')
});

const db = admin.firestore();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'quiz-app-secret-key-2025',
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/signin');
  }
  next();
};

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/signin', (req, res) => {
  res.render('signin');
});

app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });
    res.redirect('/signin');
  } catch (error) {
    res.render('signup', { error: error.message });
  }
});

app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await admin.auth().getUserByEmail(email);
    
    req.session.userId = user.uid;
    req.session.userEmail = email;
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('signin', { error: 'Error during sign in' });
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.render('signin', { error: 'Invalid email or password' });
  }
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard');
});

app.get('/quiz', requireAuth, (req, res) => {
  res.render('quiz');
});

app.post('/start-quiz', requireAuth, async (req, res) => {
    try {
        const { category, difficulty, amount } = req.body;
        
        const response = await axios.get('https://opentdb.com/api.php', {
            params: {
                amount: amount || 10,
                category: category || 9,
                difficulty: difficulty || 'medium',
                type: 'multiple'
            }
        });
        
        const questions = response.data.results.map(q => {
            const decodedQuestion = he.decode(q.question);
            const decodedCorrectAnswer = he.decode(q.correct_answer);
            const decodedIncorrectAnswers = q.incorrect_answers.map(a => he.decode(a));
            
            const answers = [...decodedIncorrectAnswers, decodedCorrectAnswer];
            return {
                ...q,
                question: decodedQuestion,
                correct_answer: decodedCorrectAnswer,
                incorrect_answers: decodedIncorrectAnswers,
                shuffledAnswers: shuffleArray(answers)
            };
        });
        
        res.render('quizpage', { 
            questions,
            currentQuestion: 0
        });
    } catch (error) {
        console.error(error);
        res.redirect('/quiz');
    }
});

app.post('/submit-quiz', requireAuth, async (req, res) => {
    try {
        const { questions } = req.body;
        const userAnswers = Object.values(req.body).slice(1);
        const parsedQuestions = JSON.parse(questions);
        
        const results = parsedQuestions.map((q, i) => ({
            question: q.question,
            correctAnswer: q.correct_answer,
            userAnswer: userAnswers[i],
            isCorrect: userAnswers[i] === q.correct_answer
        }));
        
        const score = results.filter(r => r.isCorrect).length;
        const totalQuestions = results.length;
        const percentage = Math.round((score/totalQuestions) * 100);

        const userId = req.session.userId;
        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;

        const quizResult = {
            email: userEmail,
            score: score,
            totalQuestions: totalQuestions,
            percentage: percentage,
            category: parsedQuestions[0].category,
            difficulty: parsedQuestions[0].difficulty,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('scores').add(quizResult);
        
        res.render('results', { 
            results, 
            score, 
            totalQuestions,
            userEmail 
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.redirect('/dashboard');
    }
});

app.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const scoresSnapshot = await db.collection('scores')
      .orderBy('score', 'desc')
      .get();

    const scores = [];
    const userScores = new Map();

    scoresSnapshot.forEach((doc) => {
      const scoreData = doc.data();
      const existingScore = userScores.get(scoreData.email);
      
      if (!existingScore || scoreData.score > existingScore.score) {
        userScores.set(scoreData.email, scoreData);
      }
    });

    const leaderboardScores = Array.from(userScores.values())
      .sort((a, b) => b.score - a.score)
      .map((score, index) => ({
        ...score,
        rank: index + 1
      }));

    res.render('leaderboard', { scores: leaderboardScores });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.redirect('/dashboard');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/signin');
});

const PORT = 3013;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
