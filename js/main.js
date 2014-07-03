(function (window) {
	'use strict';
	var video = document.getElementById('video'),
		enabled = document.getElementById('enabled'),
		timecode = document.getElementById('timecode'),
		position = document.getElementById('position'),
		box = document.getElementById('box'),
		boxdata = document.getElementById('boxdata'),

		FRAME_RATE = 23.976216,

		currentTime,

		popcorn,
		player,

		dragging = false,
		boxX = 0,
		boxY = 0,
		boxWidth = 0,
		boxHeight = 0;

	function fetch() {
		var xhr = new XMLHttpRequest();
		xhr.onload = function () {
			var response,
				base;

			base = {
				x: 0,
				y: 0,
				width: video.videoWidth,
				height: video.videoHeight
			};

			response = JSON.parse(xhr.responseText);
			response.forEach(function (scene) {
				var options = {
					start: Popcorn.util.toSeconds(scene.start, FRAME_RATE),
					end: scene.end && Popcorn.util.toSeconds(scene.end, FRAME_RATE)
				};
				['x', 'y', 'width', 'height'].forEach(function (field) {
					var val = scene[field],
						keyframes;

					if (typeof val === 'object') {
						keyframes = {};
						Popcorn.forEach(val, function (val, time) {
							if (/[;:]/.test(time)) {
								time = Popcorn.util.toSeconds(time, FRAME_RATE);
								time = (time - options.start) / (options.end - options.start);
							}
							keyframes[time] = val;
						});
						options[field] = keyframes;
					} else {
						options[field] = val;
					}
				});
				popcorn.responsive(options);
			});
		};
		xhr.open('GET', 'data/boxer.json');
		xhr.send();
	}


	function calcCoords(clientX, clientY) {
		var parent = video,
			x = 0,
			y = 0;

		while (parent && parent !== document.body) {
			x += parent.offsetLeft;
			y += parent.offsetTop;
			parent = parent.offsetParent;
		}

		x = clientX - x;
		y = clientY - y;

		return {
			x: x,
			y:  y
		};
	}

	function elementMatrix(element) {
		var st = window.getComputedStyle(element, null),
			tr = st.getPropertyValue("transform") ||
				st.getPropertyValue("-webkit-transform") ||
				st.getPropertyValue("-moz-transform") ||
				st.getPropertyValue("-ms-transform") ||
				st.getPropertyValue("-o-transform");

		if (tr && tr !== 'none') {
			return tr.substr(7, tr.length - 8).split(', ').map(parseFloat);
		}

		return [1, 0, 0, 1, 0, 0];
	}

	function displayCoords(e) {
		var coords = calcCoords(e.clientX, e.clientY),
			m = elementMatrix(video),
			x, y;

		//undo the CSS transform. This won't work if there's a skew or rotation
		x = (coords.x - m[4]) / m[0];
		y = (coords.y - m[5]) / m[3];

		position.innerHTML = Math.round(x) + ', ' +
			Math.round(y);
	}

	// for debugging/authoring
	function displayTime() {
		var h,
			m,
			s,
			f,
			t;

		function twoDigits(n) {
			if (n < 10) {
				return '0' + n.toString();
			}

			return n.toString();
		}

		if (currentTime !== video.currentTime) {
			currentTime = video.currentTime;
			t = currentTime;
			f = Math.round((t % 1) * FRAME_RATE);
			t = Math.floor(t);
			s = t % 60;
			t = (t - s) / 60;
			m = t % 60;
			h = (t - m) / 60;

			timecode.innerHTML = h + ':' + twoDigits(m) + ':' + twoDigits(s) + ';' + twoDigits(f);
		}

		requestAnimationFrame(displayTime);
	}

	function updateBox() {
		var topLeft,
			m = elementMatrix(video),
			top,
			left,
			width,
			height,
			bottom,
			right;


		if (boxWidth >= 0) {
			box.style.left = boxX + 'px';
			box.style.width = boxWidth + 'px';
		} else {
			box.style.left = boxX + boxWidth + 'px';
			box.style.width = -boxWidth + 'px';
		}

		if (boxHeight >= 0) {
			box.style.top = boxY + 'px';
			box.style.height = boxHeight + 'px';
		} else {
			box.style.top = boxY + boxHeight + 'px';
			box.style.height = -boxHeight + 'px';
		}

		topLeft = calcCoords(Math.min(boxX, boxX + boxWidth), Math.min(boxY, boxY + boxHeight));

		//undo the CSS transform. This won't work if there's a skew or rotation
		left = (topLeft.x - m[4]) / m[0];
		top = (topLeft.y - m[5]) / m[3];

		right = topLeft.x + Math.abs(boxWidth);
		bottom = topLeft.y + Math.abs(boxHeight);

		width = (right - m[4]) / m[0] - left;
		height = (bottom - m[5]) / m[3] - top;

		boxdata.innerHTML = [
			left, width, top, height
		].map(Math.round).join(', ');
	}

	video.addEventListener('mousedown', function (evt) {
		if (evt.which === 1) {
			dragging = true;
			boxX = evt.clientX;
			boxY = evt.clientY;
			boxWidth = 0;
			boxHeight = 0;
			box.style.display = 'block';
			updateBox();
			evt.preventDefault();
		}
	}, true);

	window.addEventListener('mousemove', function (evt) {
		if (dragging) {
			boxWidth = evt.clientX - boxX;
			boxHeight = evt.clientY - boxY;
			updateBox();
			evt.preventDefault();
		}
	}, true);

	window.addEventListener('mouseup', function () {
		dragging = false;
		if (!boxWidth || !boxHeight) {
			box.style.display = '';
		}
	}, true);

	box.addEventListener('click', function () {
		dragging = false;
		boxWidth = 0;
		boxHeight = 0;
		box.style.display = '';
	}, false);

	window.addEventListener('keyup', function(evt) {
		if (evt.which === 32) {
			if (video.paused) {
				video.play();
			} else {
				video.pause();
			}
		}
	}, true);

	window.addEventListener('keydown', function(evt) {
		if (video.paused) {
			if (evt.which === 37) {
				video.currentTime = video.currentTime - 1 / FRAME_RATE;
			} else if (evt.which === 39) {
				video.currentTime = video.currentTime + 1 / FRAME_RATE;
			}
		}
	}, true);

	window.addEventListener('mousemove', displayCoords, false);

	/*
	if (/iP(ad|hone|od)/g.test(navigator.userAgent)) {
		setInterval(resize, 500);
	}
	*/

	player = new Play({
		media: video,
		playButton: 'playbutton',
		timeline: 'timeline'
	});

	if (video.readyState) {
		fetch();
	} else {
		video.addEventListener('loadedmetadata', fetch);
	}

	popcorn = Popcorn('#video', {
		frameAnimation: true,
		framerate: FRAME_RATE
	});

	enabled.addEventListener('change', function () {
		if (enabled.checked) {
			popcorn.enable('responsive');
		} else {
			popcorn.disable('responsive');
		}
	});

	displayTime();

}(window));
