
//                                       SSSSS    EEEEE  RRRRR   V     V  EEEEE  RRRRR
//                                       S        E      R   R   V     V  E      R   R
//                                       SSSSS    EEEE   RRRRR    V   V   EEEE   RRRRR
//                                           S    E      R  R     V   V   E      R  R
//                                       SSSSS    EEEEE  R   R     V V    EEEEE  R   R



//------------------------------------------------------------------------------------------------------------------------------

//modules

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const nocache = require('nocache');
const User = require('./models/signup');
const fs = require('fs')

const port = 3000;
const app = express();
app.set('view engine', 'hbs');


//------------------------------------------------------------------------------------------------------------------------------

// Session configuration

app.use(
    session({
        secret: 'secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, maxAge: 1000 * 60 * 30 }, // 30 minutes
    })
);



//------------------------------------------------------------------------------------------------------------------------------

// Middlewares

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(nocache());


// Routes to different pages

app.get('/',  (req, res) => {
    if(req.session.admin){
        res.redirect('/adminpage')

    }else if(req.session.user){
        res.redirect('/userhome')

    }
    res.render('selection'); 
});


app.get('/userlogin', (req, res) => {
    if(req.session.user){
        res.redirect('/userhome')
    }
    res.render('userlogin'); 
});


app.get('/usersignup', (req, res) => {
    res.render('usersignup'); 
});


app.get('/userhome', (req, res) => {
    res.render('userhome', { username: req.session.user.username }); 
});


app.get('/adminlogin',  (req, res) => {
    if(req.session.admin){
        res.redirect('/adminpage')

    }
    res.render('adminlogin');

});


app.get('/adminpage', async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/adminlogin'); // Redirect to login if not logged in
    }
    try {
        const data = await User.find(); // Fetch all users
        res.render('adminpage', { users: data }); // Pass users as an object
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.render('adminpage', { error: 'Failed to fetch user data' });
    }
});




//------------------------------------------------------------------------------------------------------------------------------

//Route controllers

// Admin login post
app.post('/adminlogin', (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@gmail.com' && password === 'admin') {
        req.session.admin = true; // Set admin session
        res.redirect('/adminpage'); // Render admin page
    } else {
        res.render('adminlogin', { error: 'Invalid email or password' });
    }
    
});


// User signup post
app.post('/usersignup', async (req, res) => {
    const { username, phone, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash password
        const exist = await User.findOne({ email });
        if (exist) {
            return res.render('usersignup', { error: 'Email already exists' });
        }

        await User.create({ username, password: hashedPassword, email, phone }); // Create user
        res.redirect('/userlogin'); // Redirect to login
    } catch (error) {
        console.error(error);
        res.render('usersignup', { error: 'An error occurred. Please try again.' });
    }
});


// User login post
app.post('/userlogin', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }); // Check if user exists
        if (!user) {
            return res.render('userlogin', { error: 'Invalid credentials' });
        }

        const passwordCheck = await bcrypt.compare(password, user.password); // Verify password
        if (!passwordCheck) {
            return res.render('userlogin', { error: 'Invalid credentials' });
        }

        req.session.user = { username: user.username, email: user.email }; // Set user session
        res.redirect('/userhome'); // Redirect to home page
    } catch (error) {
        console.error(error);
        res.render('userlogin', { error: 'An error occurred.' });
    }
});


// Logout Route 
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.redirect('/userhome'); // Stay on home if logout fails
        }
        res.redirect('/'); // Redirect to login after successful logout
      
    });
    
});



//------------------------------------------------------------------------------------------------------------------------------

//Admin controls

//search
app.get('/search', async (req, res) => {
    const { query } = req.query; // Get search query from request
    try {
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } }
            ]
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



//CRUD OPERATIONS

// Delete User Route
app.delete('/admin/deleteUser/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        await User.findByIdAndDelete(userId); // Delete user by ID
        let data = await User.find()
        return res.render("adminpage", {users: data})      

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete user' });
    }
});


// add user
app.post('/adduser', async (req, res) => {
    const { username, phone, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash password
        const exist = await User.findOne({ email });
        if (exist) {
            return res.render('adminpage',{ error: 'Email already exists' });
        }
        

        await User.create({ username, password: hashedPassword, email, phone }); // Create user
        res.redirect('/adminpage'); // Redirect to login
    } catch (error) {
        console.error(error);
        res.render('adminpage', { error: 'An error occurred. Please try again.' });
    }
});


//edit user
app.get('/admin/getUser/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            res.json(user);
        } else {
            res.status(404).send({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error fetching user data' });
    }
});


app.put('/admin/editUser/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, email, phone } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username, email, phone },
            { new: true } // Return the updated document
        );

        if (updatedUser) {
            res.json({ message: 'User updated successfully' });
        } else {
            res.status(404).send({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error updating user' });
    }
});





//------------------------------------------------------------------------------------------------------------------------------



// Server
app.listen(port, () => {
    console.log('Server is running successfully');
    console.log(`Your server is running on port: ${port}`);
});



//------------------------------------------------------------------------------------------------------------------------------