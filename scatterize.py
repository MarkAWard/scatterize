#!/usr/bin/env python
import flask
import time
app = flask.Flask(__name__)


@app.route("/")
def index():
    flask.g.time = int(time.time())
    return flask.render_template("index.html")

if __name__ == "__main__":
    app.debug = True
    app.run()