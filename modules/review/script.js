(async function(){'use strict';
  if (window.SH) { try { await window.SH.ready; } catch (error) { return; } }
  const SH = window.SH;
  if (!SH) return;
  const page = document.querySelector('.m-review .review-page');
  const quiz = document.querySelector('.m-review .review-quiz');
  const root = page || quiz;
  if (!root) return;
  const samples = new Set((root.dataset.sampleSlugs || '').split(',').filter(Boolean));
  const wordKey = (word) => String(word || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function paintBest() {
    root.querySelectorAll('[data-best]').forEach((label) => {
      const holder = label.closest('[data-lesson-id]');
      const id = holder ? holder.dataset.lessonId : 'video';
      const results = SH.store.quizResults(id).filter((entry) => Number.isInteger(entry.score)
        && Number.isInteger(entry.total) && entry.total > 0 && entry.score >= 0 && entry.score <= entry.total);
      const best = results.reduce((current, item) => !current || item.score / item.total > current.score / current.total ? item : current, null);
      label.hidden = !best;
      label.textContent = best ? SH.t('review.best', { score: best.score, total: best.total, percent: Math.round(100 * best.score / best.total) }) : '';
    });
  }

  function stopMedia(container) {
    container.querySelectorAll('video').forEach((video) => video.pause());
  }

  function safeVideo(source) {
    if (typeof source !== 'string' || !source.startsWith('/') || source.startsWith('//') || /[\\\u0000-\u001f]/.test(source)) return null;
    try { return new URL(source, window.location.href).origin === window.location.origin ? source : null; }
    catch (error) { return null; }
  }

  function showMedia(container, sign, onMissing) {
    stopMedia(container);
    container.replaceChildren();
    function placeholder() {
      const missing = document.createElement('div');
      missing.className = 'sh-video-placeholder';
      missing.textContent = SH.t('shell.video.missing');
      container.replaceChildren(missing);
    }
    const source = safeVideo(sign.video);
    if (!source) { placeholder(); return false; }
    const video = document.createElement('video');
    video.src = source;
    video.controls = true;
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;
    video.preload = 'metadata';
    video.autoplay = true;
    video.loop = true;
    video.setAttribute('aria-label', SH.t('review.video.label'));
    video.addEventListener('volumechange', () => {
      if (!video.muted) video.muted = true;
      if (video.volume !== 0) video.volume = 0;
    });
    video.addEventListener('error', () => {
      if (!container.contains(video)) return;
      video.pause();
      placeholder();
      onMissing();
    });
    container.appendChild(video);
    video.play().catch(() => { /* controls remain available when autoplay is blocked */ });
    return true;
  }

  if (quiz) {
    const find = (selector) => quiz.querySelector(selector);
    const id = quiz.dataset.lessonId;
    const videoMode = quiz.dataset.quizMode === 'video';
    let questions = [];
    let position = 0;
    let score = 0;
    let answered = false;
    let finished = false;
    let mistakes = [];
    let attemptId;

    function optionsFor(sign, signs) {
      const used = new Set([wordKey(sign.word)]);
      const options = [sign];
      const same = shuffle(signs.filter((other) => other.slug !== sign.slug));
      const outside = shuffle(SH.data.signs.filter((other) => String(other.lesson) !== String(id)));
      for (const other of same.concat(outside)) {
        const key = wordKey(other.word);
        if (!key || used.has(key)) continue;
        used.add(key);
        options.push(other);
        if (options.length === 4) break;
      }
      return shuffle(options);
    }

    function paintQuestion(focus) {
      const current = questions[position];
      if (!current) return;
      answered = false;
      quiz.dataset.currentSlug = current.sign.slug;
      find('[data-question-card]').hidden = false;
      find('[data-result]').hidden = true;
      find('[data-question-position]').textContent = SH.t('review.quiz.position', { n: position + 1, total: questions.length });
      find('[data-quiz-bar]').style.width = (100 * (position + 1) / questions.length) + '%';
      find('[data-question-sample]').hidden = !samples.has(current.sign.slug);
      find('[data-feedback]').textContent = '';
      const next = find('[data-next-question]');
      next.disabled = true;
      next.textContent = SH.t(position === questions.length - 1 ? 'review.quiz.finish' : 'review.quiz.next');
      const media = find('[data-question-media]');
      stopMedia(media);
      media.replaceChildren();
      media.hidden = false;
      find('[data-question]').textContent = SH.t('review.quiz.video_question');
      showMedia(media, current.sign, () => {
        find('[data-question]').textContent = SH.t('review.quiz.video_unavailable');
        find('[data-options]').querySelectorAll('button').forEach((button) => { button.disabled = true; });
      });
      const options = find('[data-options]');
      options.replaceChildren();
      current.options.forEach((sign, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'review-option';
        button.dataset.slug = sign.slug;
        button.setAttribute('aria-pressed', 'false');
        const number = document.createElement('span');
        number.className = 'review-option-number';
        number.setAttribute('aria-hidden', 'true');
        number.textContent = String.fromCharCode(65 + index);
        const word = document.createElement('span');
        word.className = 'review-option-word';
        word.textContent = sign.word;
        button.append(number, word);
        button.addEventListener('click', () => answer(index));
        options.appendChild(button);
      });
      if (focus) find('[data-question]').focus({ preventScroll: true });
    }

    function answer(index) {
      if (answered || finished) return;
      const current = questions[position];
      const selected = current && current.options[index];
      if (!selected) return;
      answered = true;
      const correct = selected.slug === current.sign.slug;
      if (correct) score += 1;
      else mistakes.push(current.sign);
      find('[data-options]').querySelectorAll('button').forEach((button) => {
        const isCorrect = button.dataset.slug === current.sign.slug;
        const isChosen = button.dataset.slug === selected.slug;
        button.disabled = true;
        button.setAttribute('aria-pressed', String(isChosen));
        button.classList.toggle('is-correct', isCorrect);
        button.classList.toggle('is-wrong', isChosen && !isCorrect);
        if (isCorrect || isChosen) {
          const status = document.createElement('span');
          status.className = 'review-option-status';
          status.textContent = SH.t(isCorrect ? 'review.quiz.correct_option' : 'review.quiz.your_choice');
          button.appendChild(status);
        }
      });
      find('[data-feedback]').textContent = SH.t(correct ? 'review.quiz.correct' : 'review.quiz.incorrect', { word: current.sign.word });
      find('[data-next-question]').disabled = false;
      find('[data-next-question]').focus({ preventScroll: true });
    }

    async function finish() {
      if (finished || !answered || position !== questions.length - 1) return;
      finished = true;
      const total = questions.length;
      find('[data-next-question]').disabled = true;
      const saved = await SH.store.addQuizResult(id, score, total, attemptId);
      if (!saved) {
        finished = false;
        find('[data-next-question]').disabled = false;
        return;
      }
      stopMedia(find('[data-question-media]'));
      find('[data-question-card]').hidden = true;
      find('[data-result]').hidden = false;
      find('[data-result-score]').textContent = SH.t('review.result.score', { score, total, percent: Math.round(100 * score / total) });
      find('[data-result-message]').textContent = SH.t('review.result.complete');
      const list = find('[data-mistake-list]');
      list.replaceChildren();
      mistakes.forEach((sign) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = SH.url('/app/signs/' + sign.slug);
        link.textContent = sign.word;
        const meaning = document.createElement('p');
        meaning.textContent = sign.meaning;
        item.append(link, meaning);
        list.appendChild(item);
      });
      find('[data-mistakes]').hidden = mistakes.length === 0;
      find('[data-result-title]').focus({ preventScroll: true });
    }

    function restart(focus) {
      attemptId = crypto.randomUUID();
      const signs = videoMode
        ? SH.data.signs.filter((sign) => safeVideo(sign.video))
        : SH.signsOf(id).filter((sign) => safeVideo(sign.video));
      questions = shuffle(signs).map((sign) => ({ sign, options: optionsFor(sign, signs) }));
      position = 0;
      score = 0;
      answered = false;
      finished = false;
      mistakes = [];
      paintQuestion(focus);
    }

    find('[data-next-question]').addEventListener('click', () => {
      if (!answered || finished) return;
      if (position === questions.length - 1) finish();
      else { position += 1; paintQuestion(true); }
    });
    find('[data-retry]').addEventListener('click', () => restart(true));
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.target.closest('input,textarea,select,video,[contenteditable]:not([contenteditable="false"]),[role="slider"]')) return;
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); answer(Number(event.key) - 1); }
    });
    window.addEventListener('sh:store', (event) => {
      paintBest();
      if (event.detail && event.detail.type === 'reset') restart(false);
    });
    find('[data-quiz-app]').hidden = false;
    restart(false);
  }

  window.addEventListener('pagehide', () => stopMedia(root));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMedia(root); });
  paintBest();
})();
