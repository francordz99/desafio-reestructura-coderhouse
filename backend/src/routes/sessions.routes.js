import express from 'express';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import passport from 'passport';
import { config } from '../config/config';
import { usersModel } from '../../dao/models/usersModel';

const router = Router();


router.post("/register", passport.authenticate("signupLocalStrategy", {
    failureRedirect: "/failed-signup"
}), async (req, res) => {
    res.render("login", { message: "Usuario Registrado Correctamente" });
});

router.get("/signup-github", passport.authenticate("signupGithubStrategy"));

router.get(config.github.callbackUrl, passport.authenticate("signupGithubStrategy", {
    failureRedirect: "/api/sessions/fail-signup"
}), (req, res) => {
    res.redirect("/");
});

router.get("/fail-signup", (req, res) => {
    res.render("register", { error: "No pudiste registrarte correctamente" });
});

router.post("/login", passport.authenticate("loginLocalStrategy", { failureRedirect: "/api/sessions/fail-login" }), async (req, res) => {
    res.redirect("/");
});

router.get("/fail-login", (req, res) => {
    res.render("login", { error: "No pudiste iniciar sesión correctamente" });
})

router.get("/logout", async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) return res.render("profile", { error: "No se pudo cerrar la sesion" });
            res.redirect("/");
        });
    } catch (error) {
        res.render("profile", { error: "No se pudo cerrar la sesion" });
    }
});

router.get('/current', (req, res) => {
    if (req.isAuthenticated()) {
        const currentUser = req.user;
        res.json(currentUser);
    } else {
        res.json({ message: 'No hay usuario actual' });
    }
});

export const sessionsRouter = router;
