# app.py: main Flask application for NutriBalance PWA, handling routes, authentication, and data management
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_wtf import FlaskForm, CSRFProtect
from wtforms import StringField, PasswordField, DateField, SubmitField
from wtforms.validators import DataRequired, EqualTo, Length, Regexp
import pyotp, qrcode, base64
from io import BytesIO
from datetime import timedelta
from config import Config
import user_management as um

# Factory function to create and configure the Flask app
def create_app():
    app = Flask(__name__, static_folder="static", template_folder="templates")
    # Initialize Flask application with static and template folders
    app.config.from_object(Config)
    csrf = CSRFProtect(app)

    # Ensure a database connection is available before each request
    @app.before_request
    def before_request():
        um.get_db()

    # Clean up and close the database connection after each request
    @app.teardown_appcontext
    def teardown_app(exception):
        um.close_db(exception)

    # Form definition for user signup with validation rules
    class SignupForm(FlaskForm):
        username = StringField('Username', validators=[DataRequired()])
        password = PasswordField('Password', validators=[
            DataRequired(), Length(min=8), Regexp(r'(?=.*[A-Z])'), Regexp(r'(?=.*[a-z])')
        ])
        confirm_password = PasswordField('Confirm Password', validators=[
            DataRequired(), EqualTo('password')
        ])
        dob = DateField('Date of Birth', format='%Y-%m-%d', validators=[DataRequired()])
        submit = SubmitField('Sign Up')

    # Utility to generate a base64-encoded QR code for TOTP setup
    def generate_qr_code(uri):
        # Build the QR code object with specified box size and border
        qr = qrcode.QRCode(box_size=6, border=2)
        qr.add_data(uri); qr.make(fit=True)
        img = qr.make_image()
        buf = BytesIO(); img.save(buf)
        return base64.b64encode(buf.getvalue()).decode()

    # Route to handle user login and start two-factor authentication
    @app.route("/login", methods=["GET", "POST"])
    def login():
        # Redirect authenticated users to home page
        if session.get("authenticated"):
            return redirect(url_for("home"))
        error = None
        if request.method == "POST":
            u = request.form["username"].strip()
            p = request.form["password"].strip()
            if um.verify_user(u, p):
                session.permanent = True
                session["user"] = u
                session["authenticated"] = False
                secret = pyotp.random_base32()
                session["user_secret"] = secret
                uri = pyotp.TOTP(secret).provisioning_uri(u, issuer_name="NutriBalance")
                session["qr_code"] = generate_qr_code(uri)
                return redirect(url_for("two_factor"))
            else:
                error = "Invalid username or password."
        return render_template("login.html", error=error)

    # Route to register a new user
    @app.route("/signup.html", methods=["GET", "POST"])
    def signup():
        form = SignupForm()
        if form.validate_on_submit():
            um.insert_user(
                form.username.data.strip(),
                form.password.data.strip(),
                form.dob.data.strftime("%Y-%m-%d")
            )
            return redirect(url_for("login"))
        return render_template("signup.html", form=form)

    # Route for two-factor authentication verification
    @app.route("/2fa", methods=["GET", "POST"])
    def two_factor():
        if request.method == "GET":
            return render_template("2fa.html", qr_code=session.get("qr_code"))
        otp = request.form.get("otp", "").strip()
        if pyotp.TOTP(session.get("user_secret")).verify(otp):
            session["authenticated"] = True
            return redirect(url_for("home"))
        return render_template("2fa.html", qr_code=session.get("qr_code"), error="Invalid OTP.")

    # Home page route; requires user to be authenticated
    @app.route("/", methods=["GET"])
    @app.route("/index.html", methods=["GET"])
    def home():
        if not session.get("authenticated"):
            return redirect(url_for("login"))
        return render_template("index.html")

    # Route to clear session and log out the user
    @app.route("/logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))

    # API endpoint to return stored user data as JSON
    @app.route("/get_user_data")
    def get_user_data_route():
        if not session.get("authenticated"):
            return jsonify({"error":"Unauthorized"}), 401
        return jsonify(um.get_user_data(session["user"]))

    # API endpoint to save user data sent as JSON payload
    @app.route("/save_user_data", methods=["POST"])
    def save_user_data_route():
        if not session.get("authenticated"):
            return jsonify({"error":"Unauthorized"}), 401
        payload = request.get_json()
        um.save_user_data(
            session["user"],
            payload.get("entries", []),
            payload.get("targets", {})
        )
        return jsonify({"status":"ok"})

    # Initialize database tables when the app context starts
    with app.app_context():
        um.init_db()

    return app
#Run
if __name__ == "__main__":
    create_app().run(debug=True, host="0.0.0.0", port=5300)