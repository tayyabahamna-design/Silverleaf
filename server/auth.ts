// Username/Password Authentication - based on blueprint:javascript_auth_all_persistance
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('[AUTH] Login attempt for username:', username);
        // UPDATED: Try both username and email for login
        let user = await storage.getUserByUsername(username);
        if (!user) {
          user = await storage.getUserByEmail(username);
        }
        console.log('[AUTH] User found:', !!user);
        
        if (!user) {
          console.log('[AUTH] User not found');
          return done(null, false);
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        console.log('[AUTH] Password match:', passwordMatch);
        
        if (!passwordMatch) {
          console.log('[AUTH] Password mismatch');
          return done(null, false);
        }
        
        console.log('[AUTH] Login successful for user:', user.username);
        return done(null, user);
      } catch (error) {
        console.error('[AUTH] Error during authentication:', error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  // Register new trainer account (public)
  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Admin accounts are auto-approved, trainers need admin approval
      const isAdmin = req.body.role === "admin";
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
        approvalStatus: isAdmin ? "approved" : "pending",
      });

      const { password, ...userWithoutPassword } = user;
      
      if (isAdmin) {
        // Auto-login admin accounts
        req.login(user, (err) => {
          if (err) {
            return res.status(201).json({
              ...userWithoutPassword,
              message: "Admin account created successfully."
            });
          }
          res.status(201).json(userWithoutPassword);
        });
      } else {
        // Don't auto-login - trainers need approval first
        res.status(201).json({
          ...userWithoutPassword,
          message: "Account created successfully. Your account is pending admin approval."
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser | false) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Check if account is approved
      if (user.approvalStatus === "pending") {
        return res.status(403).json({ 
          message: "Your account is pending approval. Please wait for admin approval.",
          approvalStatus: "pending"
        });
      }
      
      if (user.approvalStatus === "rejected") {
        return res.status(403).json({ 
          message: "Your account has been rejected. Please contact support.",
          approvalStatus: "rejected"
        });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send password back to client
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Don't send password back to client
    const { password, ...userWithoutPassword } = req.user!;
    res.json(userWithoutPassword);
  });
}
