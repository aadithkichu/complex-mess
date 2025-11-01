export const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    // User is a logged-in admin
    next();
  } else {
    // User is a public viewer
    res.status(401).json({ message: 'Unauthorized: Admin access required.' });
  }
};