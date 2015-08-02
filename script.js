window.onload = function() {
	function fetchSamples(textAreaId) {
		var ta = document.getElementById(textAreaId);
		//if ta null short short circuiting yeilds []
		var lines = (ta && ta.value.split('\n')) || [];
		var samples = []
		for(var i = 0; i < lines.length; i++) {
			var l = lines[i].trim();
			if(l)samples.push(l);
		}
		return samples;
	}
	function map(list, f) {
		var newList = [];
		for(var i = 0; i < list.length; i++) {
			newList.push(f(list[i]));
		}
		return newList;
	}
	function filter(list, predicate) {
		var newList = [];
		for(var i = 0; i < list.length; i++) {
			if(predicate(list[i])) {
				newList.push(list[i]);
			}
		}
		return newList;
	}
	function shuffle(o){
		//from stack overflow (looks like Fisher Yates)
		for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
		return o;
	}
	function get(url, callback) {
		var request = new XMLHttpRequest();
		request.onload = callback;
		request.open('GET', url, true);
		request.send();
	}
	function partition(list, percent) {
		percent = percent || 0.6;
		if(percent > 1) {
			percent = 1;
		} else if(percent < 0.1) {
			percent = 0.1;
		}
		var mid = list.length * percent;
		var parts = {};
		parts.train = list.slice(0,mid);
		parts.test = list.slice(mid,list.length);
		return parts;
	}
	function printTrainingData(list) {
		showHeaders();
		var div = document.getElementById('training');
		if(!div) {
			console.error('could not fetch element');
			return;
		}
		for(var i = 0; i < list.length; i++) {
			var line = document.createElement('div');
			line.innerText = 'Type: ' + (list[i].type === 1 ? '1' : '2') + ' Text: ' + list[i].text;
			div.appendChild(line);
		}
	}
	function hideHeaders() {
		document.getElementById('trainHeader').style.visibility = "hidden";
		document.getElementById('testHeader').style.visibility = "hidden";
		document.getElementById('portionCorrect').style.visibility = "hidden";
	}
	function showHeaders() {
		document.getElementById('trainHeader').style.visibility = "visible";
		document.getElementById('testHeader').style.visibility = "visible";
		document.getElementById('portionCorrect').style.visibility = "visible";
	}
	function tokenize(s) {
		return s.toLowerCase().replace(/\W/g,' ').replace(/\s+/g,' ').trim().split(/\s/);
	}
	function bayes() {
		var labelCounts = {};
		var wordCounts = {};
		var numberOfSamples = 0;
		function incrementLabelCount(label) {
			labelCounts[label] = labelCounts[label] ? labelCounts[label] + 1 : 1;
			numberOfSamples++;
		}
		function incrementWordCount(word, label) {
			if(wordCounts[word] === undefined) {
				wordCounts[word] = {};
			}
			wordCounts[word][label] = wordCounts[word][label] ? wordCounts[word][label] + 1 : 1;
		}
		function trainOn(text, label) {
			var words = tokenize(text);
			for(var i = 0; i < words.length; i++) {
				incrementWordCount(words[i], label);
			}
			incrementLabelCount(label);
		}
		var train = function(samples) {
			for(var i = 0; i < samples.length; i++) {
				trainOn(samples[i].text, samples[i].type);
			}
		}
		function getMostLikelyLabel(probabilities) {
			var maxLabel = '???', maxProb = -Infinity; //the reason is that probabilities stores the log of the actual probabilites
			for(var l in probabilities) {
				if(probabilities[l] > maxProb) {
					maxLabel = l;
					maxProb = probabilities[l];
				}
			}
			return maxLabel;
		}
		var classify = function(text) {
			//P(Ck|x1, ..., xn) = p(Ck)p(x1|Ck)* ... *p(xn|Ck)/p(x)
			//p(x) is same for all C, so it can be ignored
			//log p(Ck) + sum log p(xi|Ck)  if p(xi|Ck) = 0 then ignore
			var words = tokenize(text);
			var probabilities = {};
			for(var l in labelCounts) {
				var p = Math.log(labelCounts[l]/numberOfSamples);
				for(var w in words) {
					if(w in wordCounts) { //not sure what to do if p(xi|Ck) = 0 (cannot take log of that)
						if(wordCounts[w][l])
							p += Math.log(wordCounts[w][l]/labelCounts[l]);
						else
							p += Math.log(0.1/labelCounts[l]);
					}
				}
				probabilities[l] = p;
			}
			return getMostLikelyLabel(probabilities);
		}
		return { train: train, classify: classify};
	}
	function printTestResults(list, classifier) {
		var div = document.getElementById('testing');
		if(!div) {
			console.error('could not fetch element');
			return;
		}
		if(list.length <= 0) {
			return;
		}
		var numCorrect = 0;
		for(var i = 0; i < list.length; i++) {
			var line = document.createElement('div');
			var correct = list[i].type === 1 ? '1' : '2';
			var guess = classifier.classify(list[i].text);
			line.innerText = 'Type: ' + correct + ' Classification: ' + guess +
					' Text: ' + list[i].text;
			if(guess === correct) {
				numCorrect++;
				line.classList.add('correct');
			} else {
				line.classList.add('wrong');
			}
			div.appendChild(line);
		}
		var percentsDiv = document.getElementById('percents');
		percentsDiv.innerText = 'Correct: ' + 100*numCorrect/list.length + '% Wrong: ' + 100*(1 - numCorrect/list.length) + '%';
	}
	document.getElementById('train').onclick = function() {
		var type1 = map(fetchSamples('type1'), function(o) { return { text: o, type: 1}});
		var type2 = map(fetchSamples('type2'), function(o) { return { text: o, type: 2}});
		var samples = shuffle(type1.concat(type2));
		var trainPercent = parseFloat(document.getElementById('trainPercent').value);
		var testPercent = 1.0 - trainPercent;
		document.getElementById('testPercent').innerText = testPercent;
		var parts = partition(samples, testPercent);
		printTrainingData(parts.train);
		var model = bayes();
		model.train(parts.train);
		printTestResults(parts.test, model);
		
		//calculate probabilities + frequencies ...
		//P(C|x1,x2, ..., xn) = P(C) * product(P(xi|C) , i in [1, ..., n])/Z
		//Take log of sides to convert product to sum
		//test on test data & print results
	}
	document.getElementById('load').onclick = function() {
		document.getElementById('type1').value = '';
		document.getElementById('type2').value = '';
		get('buzzfeed.txt', function() {
			document.getElementById('type1').value += this.response;
		});
		get('nytimes.txt', function() {
			document.getElementById('type2').value += this.response;
		});
		// get('upworthy.txt', function() {
			// document.getElementById('type1').value += this.response;
		// });
		// get('time.txt', function() {
			// document.getElementById('type2').value += this.response;
		// });
		
	}
}
