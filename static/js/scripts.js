// 全局DOM元素引用
globalLoading = document.getElementById('global-loading');
globalCurrentPage = document.getElementById('current-page');
globalCurrentCount = document.getElementById('current-count');

// 全局配置
globalPageSize = 20;
globalLoggedIn = false;
globalCourses = [];
globalLoadedCourses = [];
globalCurrentUsername = "";
globalCourseListLoaded = false;

globalAutoRefreshTask = false; // 是否自动刷新任务列表
globalIndicatorInterval = null; // 用于存储自动刷新任务的定时器
currentIndicatorSteps = 0;
totalIndicatorStepsForCycle = 0;

const WEEK_CN = {
    '1': '一',
    '2': '二',
    '3': '三',
    '4': '四',
    '5': '五',
    '6': '六',
    '7': '日',
}

const TASK_STATUS_MAP = {
    0: "空闲/完成",
    1: "等待开始",
    2: "正在进行",
}

const MAX_COURSE_NAME_CHARS_PER_LINE = 40; // 每行最多显示的课程名称字符数

// 已加载课程，避免重复加载
let displayedCourseIdsInTable = new Set();

var gdutmoe_triggered = false;

function toggleSidebar() {
    const menuBtn = document.getElementById('menu-btn');
    const faviconImgHtml = '<img src="img/GDUTMoe.png" height="32px" width="32px">';
    const leftArrowSvg = `
    <svg viewBox="0 -960 960 960" aria-hidden="true" focusable="false">
        <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z"></path>
    </svg>
    `;
    const rightArrowSvg = `
    <svg viewBox="0 -960 960 960" aria-hidden="true" focusable="false">
        <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"></path>
    </svg>
    `;
    const trigger_msg = document.createElement('span');
    trigger_msg.innerHTML = `<div align="center"><img src="img/GDUTMoe.png" height="200px"></div><p>恭喜你发现了一个小彩蛋，左上角的图标已经换成了可爱的工娘了哦，工娘在这里给你问好 (*^▽^*)</p><p>左上角的图标已经换成了可爱的工娘了哦</p><p>工娘图来源：https://tieba.baidu.com/p/9023794849</p>`
    if (Math.random() < 0.1 && !gdutmoe_triggered) {
        menuBtn.innerHTML = faviconImgHtml;
        showDialog('恭喜',
            trigger_msg,
            'success', html = true
        )
        gdutmoe_triggered = true;
    } else {
        if (gdutmoe_triggered) {
            // 触发了彩蛋，不再进行替换
        }
        else if (menuBtn.value === '1') {
            menuBtn.innerHTML = leftArrowSvg;
            menuBtn.value = '0';
        } else {
            menuBtn.innerHTML = rightArrowSvg;
            menuBtn.value = '1';
        }
    }
    document.querySelector('s-drawer').toggle();
}

function openGithub() {
    window.open('https://github.com/GDUTMeow/gdut-course-grabber', '_blank');
}

function openGDUT() {
    window.open('https://www.gdut.edu.cn', '_blank');
}

function openGDUTJW() {
    window.open('https://jxfw.gdut.edu.cn/login!welcome.action', '_blank');
}

async function changeAccentColor(color = null) {
    if (!color) {
        const accentColor = await getData('accentColor');
        if (accentColor && accentColor !== '#7746ac') {
            const colorPicker = document.querySelector('#color-picker');
            colorPicker.value = accentColor;
            sober.theme.createScheme(accentColor, { page: document.querySelector('s-page') });
        }
    } else {
        sober.theme.createScheme(color, { page: document.querySelector('s-page') });
    }
}

function showDialog(title, content, level, html = false) {
    const dialog = document.getElementById('dialog');
    const dialogTitle = document.getElementById('dialog-title');
    const dialogContent = document.getElementById('dialog-descr');

    if (level === 'error') {
        dialogTitle.innerText = `🔴 ${title}`;
    } else if (level === 'success') {
        dialogTitle.innerText = `🟢 ${title}`;
    } else {
        dialogTitle.innerText = `🔵 ${title}`;
    }

    if (html) {
        dialogContent.innerHTML = '';
        dialogContent.appendChild(content);
    } else {
        dialogContent.innerText = content;
    }
    dialog.setAttribute('showed', 'true');
}

function changePanel(panelId) {
    const panels = ['courses-panel', 'operation-panel', 'task-panel'];
    panels.forEach((id, index) => {
        const panel = document.getElementById(id);
        if (index === panelId) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });

    if (panelId === 1) {
        initializeSelectedCourseTable();
    }
    if (panelId === 2) {
        flushTaskTable();
    }
}

async function initialize() {
    const status = document.getElementById('status');
    await getAccountList()
    const storedCourses = await getData('userSelectedCourses');
    if (storedCourses) {
        try {
            const parsedCourses = JSON.parse(storedCourses);
            if (Array.isArray(parsedCourses)) {
                globalCourses = parsedCourses;
            } else {
                console.warn("localStorage中selectedCourses数据格式不正确，已重置");
                globalCourses = [];
            }
        } catch (e) {
            console.error("解析localStorage中的selectedCourses失败:", e);
            globalCourses = [];
        }
    } else {
        globalCourses = [];
    }
    changeAccentColor();
}

function saveAndLogin(positive = true) {
    const cookieField = document.getElementById('cookie');
    if (!cookieField.value) {
        showToast('请先输入 JSESSIONID 再进行登录！', 'error');
        return;
    }
    const cookie = cookieField.value.replace("JSESSIONID=", "").trim();
    login(cookie, positive);
    syncSessionId(); // 登录后同步一次
}

function login(cookie, positive = true) {
    const saveBtn = document.getElementById('save-config-btn');
    const loadingIndicator = document.getElementById('save-config-btn-loading');
    saveBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');

    return fetch(`/api/eas/courses?count=1&page=1&session_id=${cookie}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => {
            if (response.ok) {
                return response.json().then(jsonResponse => {
                    globalLoggedIn = true;
                    saveData('userSessionId', cookie);
                    if (positive) {
                        showToast('登录成功！', 'success');
                    }
                    document.getElementById('content-no-content-tip').classList.add('hidden');
                    document.getElementById('content-table-body').innerHTML = '';
                    globalCurrentPage.innerText = '0';
                    globalCurrentCount.innerText = '0';
                    flushCoursesTable();
                    return true;
                });
            } else {
                return response.json().then(errorData => {
                    const errorMessage = errorData.message || `服务器返回错误状态码: ${response.status}.`;
                    document.getElementById('status').innerText = '🔴 登录出错，请尝试更新 JSESSIONID';
                    if (positive) {
                        showDialog("错误", `登录失败：${errorMessage}`, 'error');
                    }
                    return false;
                }).catch(() => {
                    document.getElementById('status').innerText = '🔴 登录出错，请尝试更新 JSESSIONID';
                    if (positive) {
                        showDialog('错误', `登录失败：服务器返回状态码 ${response.status}`, 'error');
                    }
                    return false;
                });
            }
        })
        .catch(error => {
            document.getElementById('status').innerText = '🔴 登录出错';
            if (positive) {
                showDialog('错误', `登录失败，请稍后重试或查看控制台\n${error.message || error}\n如果出现了严重的错误，可以考虑开个 issue: https://github.com/GDUTMeow/gdut-course-grabber/issues/new`, 'error');
            }
            console.error('登录失败:', error);
            return false;
        })
        .finally(() => {
            saveBtn.disabled = false;
            loadingIndicator.classList.add('hidden');
        });
}

function flushCoursesTable() {
    document.getElementById('content-table-body').innerHTML = '';
    globalCurrentPage.innerText = '0';
    globalCurrentCount.innerText = '0';
    displayedCourseIdsInTable.clear();
    globalLoadedCourses = []; // 清空已加载课程列表
    globalCourseListLoaded = false;
    loadMoreCourses();
}

function onChangePageSize(size, custom = false) {
    if (!custom) {
        document.getElementById('custom-page-size-input').classList.add('hidden');
        document.getElementById('custom-page-size-btn').classList.add('hidden');
    }
    globalPageSize = Number(size);
    flushCoursesTable();
}

function onCustomPageSizeChecked() {
    document.getElementById('custom-page-size-input').classList.remove('hidden');
    document.getElementById('custom-page-size-input').value = "";
    document.getElementById('custom-page-size-btn').classList.remove('hidden');
}

async function fetchNewCourses(page = 1, size = 20, positive = true, username = globalCurrentUsername) {
    globalLoading.setAttribute('showed', 'true');

    if (!globalLoggedIn || !username) {
        showToast('请先选择账号后再进行操作', 'error');
        globalLoading.setAttribute('showed', 'false');
        return Promise.resolve(false);
    }

    return fetch(`/api/eas/courses?count=${size}&page=${page}&username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return response.json().then(errorData => {
                    const errorMessage = errorData.message || `服务器返回错误状态码: ${response.status}.`;
                    throw new Error(errorMessage);
                }).catch(() => {
                    throw new Error(`获取课程列表失败，服务器返回状态码: ${response.status}`);
                });
            }
        })
        .then(jsonResponse => {
            if (jsonResponse.error && jsonResponse.error !== "ok" && jsonResponse.error !== "unexpected") {
                if (jsonResponse.message) {
                    showDialog('提示', jsonResponse.message, 'info');
                } else {
                    showDialog('错误', '获取课程列表时服务器返回未知错误', 'error');
                }
                return (jsonResponse.data && Array.isArray(jsonResponse.data)) ? jsonResponse.data : [];
            }
            return jsonResponse.data || [];
        })
        .catch(error => {
            showDialog('错误', `获取课程列表失败，请稍后重试或查看控制台\n${error.message || error}\n如果出现了严重的错误，可以考虑开个 issue: https://github.com/GDUTMeow/gdut-course-grabber/issues/new`, 'error');
            console.error('获取课程失败:', error);
            return false;
        })
        .finally(() => {
            globalLoading.setAttribute('showed', 'false');
        });
}

function loadMoreCourses() {
    const currentPage = Number(globalCurrentPage.innerText);
    const newPage = currentPage + 1;
    const username = globalCurrentUsername;
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadingIndicator = document.getElementById('load-more-btn-loading');
    const tableLoadingContainer = document.getElementById('course-table-loading-container');
    const emptyMessage = document.getElementById('content-no-content-tip');
    loadMoreBtn.setAttribute('disabled', 'true');
    loadingIndicator.classList.remove('hidden');
    tableLoadingContainer.classList.remove('hidden');
    emptyMessage.classList.add('hidden');

    return fetchNewCourses(newPage, globalPageSize, true, username)
        .then(coursesData => {
            if (username !== globalCurrentUsername) {
                return;
            }
            if (coursesData && Array.isArray(coursesData)) {
                globalCourseListLoaded = true;
                let newCoursesAddedCount = 0;
                coursesData.forEach(course => {
                    if (course && typeof course.id !== 'undefined') {
                        const courseIdStr = String(course.id);
                        if (!displayedCourseIdsInTable.has(courseIdStr)) {
                            addLineToCourseTable(
                                decodeHtmlEntities(course.name),
                                course.id,
                                course.teacher,
                                course.category,
                                course.chosen,
                                course.limit,
                                course.source,
                                course.note
                            );
                            displayedCourseIdsInTable.add(courseIdStr);
                            newCoursesAddedCount++;
                            globalLoadedCourses.push(course);
                        }
                    } else {
                        console.warn("Encountered a course with missing ID or invalid course object:", course);
                    }
                });

                if (newCoursesAddedCount > 0) {
                    globalCurrentPage.innerText = newPage.toString();
                    globalCurrentCount.innerText = (Number(globalCurrentCount.innerText) + newCoursesAddedCount).toString();
                } else if (newPage > 1) {
                    showToast('没有更多新的课程了，已经加载完所有课程', 'info');
                }

                if (globalLoadedCourses.length === 0) {
                    emptyMessage.classList.remove('hidden');
                }
            } else if (coursesData === false) {
            } else {
                console.warn('loadMoreCourses: 未获取到新的课程数据或数据格式不正确 Data received:', coursesData);
            }
        })
        .finally(() => {
            loadMoreBtn.removeAttribute('disabled');
            loadingIndicator.classList.add('hidden');
            tableLoadingContainer.classList.add('hidden');
        });
}

function addLineToCourseTable(name, id, teacher, category, chosen, limit, source = 0, note = "") {
    const table_body = document.getElementById('content-table-body');
    const table_line = document.createElement('s-tr');
    const operation_td = document.createElement('s-td');
    const add_btn = document.createElement('s-button');
    const detail_btn = document.createElement('s-button');

    add_btn.innerText = '添加到列表';
    add_btn.setAttribute('type', 'outlined');
    add_btn.setAttribute('classId', String(id));

    const courseRawData = {
        name: name,
        teacher: teacher,
        category: category || "",
        chosen: chosen,
        limit: limit,
        source: source,
        note: note || ""
    };
    add_btn.dataset.courseRaw = JSON.stringify(courseRawData);

    add_btn.setAttribute('onclick', `addCourse(this.getAttribute('classId'), JSON.parse(this.dataset.courseRaw))`);
    add_btn.style.marginRight = '8px';

    detail_btn.innerText = '查看详情';
    detail_btn.setAttribute('classId', String(id));
    detail_btn.setAttribute('onclick', "showCourseDetail(this.getAttribute('classId'))");

    const limit_td = document.createElement('s-td');
    const limit_linear = document.createElement('s-linear-progress');
    const numSelected = Number(chosen);
    const numLimit = Number(limit);

    if (isNaN(numLimit) || isNaN(numSelected) || numLimit === 0 || limit === "?" || chosen === "?") {
        limit_linear.setAttribute('value', '0');
        limit_td.innerText = `${chosen || '?'}/${limit || '?'} (?%)`;
    } else {
        limit_linear.setAttribute('value', String((numSelected / numLimit) * 100));
        limit_td.innerText = `${numSelected}/${numLimit} (${(numSelected / numLimit * 100).toFixed(2)}%)`;
        if (numSelected >= numLimit) {
            limit_td.style.color = 'var(--s-color-error)';
            limit_td.style.fontWeight = 'bold';
        }
        limit_td.appendChild(limit_linear);

        operation_td.appendChild(add_btn);
        operation_td.appendChild(detail_btn);

        const name_td = document.createElement('s-td');
        const formattedCourseName = processCourseName(name);
        name_td.innerHTML = `${formattedCourseName} (${id})`;
        name_td.style.alignContent = "center";
        table_line.appendChild(name_td);

        const teacher_td = document.createElement('s-td');
        teacher_td.innerText = teacher;
        teacher_td.style.alignContent = "center";
        table_line.appendChild(teacher_td);

        const category_td = document.createElement('s-td');
        category_td.innerText = category;
        category_td.style.alignContent = "center";
        table_line.appendChild(category_td);

        table_line.appendChild(limit_td);
        table_line.appendChild(operation_td);

        table_body.appendChild(table_line);
    }
}

function formatWeeksArrayToDisplayString(weeks) {
    if (!weeks || !Array.isArray(weeks) || weeks.length === 0) {
        return "未知";
    }
    const sortedWeeks = [...new Set(weeks)].sort((a, b) => a - b);
    let weekStr = "";
    if (sortedWeeks.length > 0) {
        let startRange = sortedWeeks[0];
        for (let i = 0; i < sortedWeeks.length; i++) {
            if (i + 1 < sortedWeeks.length && sortedWeeks[i + 1] === sortedWeeks[i] + 1) {
            } else {
                if (weekStr) weekStr += ", ";
                if (startRange === sortedWeeks[i]) {
                    weekStr += startRange;
                } else {
                    weekStr += `${startRange}-${sortedWeeks[i]}`;
                }
                if (i + 1 < sortedWeeks.length) {
                    startRange = sortedWeeks[i + 1];
                }
            }
        }
    }
    return weekStr || "未知";
}

async function fetchCourseDetail(classId, positive = true, username = globalCurrentUsername) {
    if (!username) {
        showToast('请先选择账号后再进行操作', 'error');
        return Promise.resolve(false);
    }
    globalLoading.setAttribute('showed', 'true');

    return fetch("/api/eas/courses/" + classId + "/lessons?username=" + encodeURIComponent(username), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return response.json().then(errorData => {
                    const errorMessage = errorData.message || `获取课程详情失败，服务器返回状态码: ${response.status}.`;
                    throw new Error(errorMessage);
                }).catch(() => {
                    throw new Error(`获取课程详情失败，服务器返回状态码: ${response.status}`);
                });
            }
        })
        .then(jsonResponse => {
            const courseLessons = jsonResponse.data;

            if (jsonResponse.error && jsonResponse.error !== "ok" && jsonResponse.error !== "unexpected") {
                throw new Error(jsonResponse.message || '获取课程详情时服务器返回错误');
            }

            if (!Array.isArray(courseLessons) || courseLessons.length === 0) {
                console.warn(`课程 ${classId} 未找到授课安排，将使用基础信息`);
                if (!positive) {
                    return {
                        term: "未知",
                        weeks: [],
                        day: null,
                        content_type: "未知",
                        location_type: "未知",
                        location: "未指定",
                        sessions: { start: '?', end: '?' },
                    };
                } else {
                    throw new Error('未找到课程详细信息或课程无授课安排');
                }
            }

            const firstLesson = courseLessons[0];
            const nameFromDetail = firstLesson.name;
            const term = firstLesson.term;
            const day = firstLesson.day;
            const content_type = firstLesson.content_type;
            const location_type = firstLesson.location_type;
            const location = firstLesson.location;
            const teachers = firstLesson.teachers;
            const sessions = firstLesson.sessions;
            const weeksArray = courseLessons.map(lesson => lesson.week).filter(week => typeof week === 'number');
            const teacherStr = Array.isArray(teachers) ? teachers.join(', ') : (teachers || "未知教师");
            const sessionStart = Array.isArray(sessions) && sessions.length > 0 ? Math.min(...sessions) : '?';
            const sessionEnd = Array.isArray(sessions) && sessions.length > 0 ? Math.max(...sessions) : '?';

            if (positive) {
                const weekStrDisplay = formatWeeksArrayToDisplayString(weeksArray);
                const content = document.createElement("ul");
                content.appendChild(document.createElement("li")).innerText = `课程教学班: ${nameFromDetail}`;
                content.appendChild(document.createElement("li")).innerText = `授课学期: ${term || '未知'}`;
                content.appendChild(document.createElement("li")).innerText = `授课周次: 第 ${weekStrDisplay} 周`;
                content.appendChild(document.createElement("li")).innerText = `授课星期: 每周${WEEK_CN[day.toString()] || '?'}`;
                content.appendChild(document.createElement("li")).innerText = `授课内容类型: ${content_type || '未知'}`;
                content.appendChild(document.createElement("li")).innerText = `授课地点: ${location || '未指定'} (${location_type || '未知'})`;
                content.appendChild(document.createElement("li")).innerText = `授课教师: ${teacherStr}`;
                content.appendChild(document.createElement("li")).innerText = `授课节次: 第 ${sessionStart} - ${sessionEnd} 节`;
                showDialog('课程详情', content, 'info', html = true);
                return true;
            } else {
                return {
                    term: term,
                    weeks: weeksArray,
                    day: day,
                    content_type: content_type,
                    location_type: location_type,
                    location: location,
                    sessions: {
                        start: sessionStart,
                        end: sessionEnd
                    },
                    nameFromDetail: nameFromDetail,
                    teacherFromDetail: teacherStr
                };
            }
        })
        .catch(error => {
            console.error(`获取课程 ${classId} 详情失败:`, error);
            if (positive) {
                showToast(`获取课程详情失败: ${error.message || error}`, 'error');
            }
            return false;
        })
        .finally(() => {
            globalLoading.setAttribute('showed', 'false');
        });
}

function showCourseDetail(classId, username = globalCurrentUsername) {
    fetchCourseDetail(classId, true, username);
}

async function addCourse(classId, courseRawData) {
    if (!globalLoggedIn || !globalCurrentUsername) {
        showToast('请先选择账号后再进行操作', 'error');
        return;
    }

    const classIdStr = String(classId);
    const existingCourse = globalCourses.find(course => String(course.id) === classIdStr);
    if (existingCourse) {
        showToast(`课程 「${courseRawData.name || existingCourse.name} (${classIdStr})」 已经在列表中了`, 'error');
        return;
    }

    globalLoading.setAttribute('showed', 'true');
    fetchCourseDetail(classIdStr, false)
        .then(lessonDetails => {
            globalLoading.setAttribute('showed', 'false');
            if (lessonDetails === false) {
                showToast(`无法添加课程 「${courseRawData.name || classIdStr}」，获取上课安排失败`, 'error');
                return;
            }

            const safeLessonDetails = (typeof lessonDetails === 'object' && lessonDetails !== null) ? lessonDetails : {
                term: "未知", weeks: [], day: null, content_type: "未知",
                location_type: "未知", location: "未指定", sessions: { start: '?', end: '?' }
            };


            const courseToAdd = {
                id: classIdStr,
                name: String(courseRawData.name || "未知课程"),
                teacher: String(courseRawData.teacher || "未知教师"),
                category: String(courseRawData.category || ""),
                chosen: courseRawData.chosen !== undefined ? Number(courseRawData.chosen) : 0,
                limit: courseRawData.limit !== undefined ? Number(courseRawData.limit) : 0,
                source: courseRawData.source !== undefined ? Number(courseRawData.source) : 0,
                note: String(courseRawData.note || ""),

                term: safeLessonDetails.term,
                weeks: safeLessonDetails.weeks,
                day: safeLessonDetails.day,
                content_type: safeLessonDetails.content_type,
                location_type: safeLessonDetails.location_type,
                location: safeLessonDetails.location,
                sessions: safeLessonDetails.sessions,
            };

            globalCourses.push(courseToAdd);
            saveData('userSelectedCourses', globalCourses);
            showToast(`课程 「${courseToAdd.name} (${classIdStr})」 已添加到列表`, 'success');
            if (document.getElementById('operation-panel').classList.contains('hidden') === false) {
                initializeSelectedCourseTable();
            }
        })
        .catch(error => {
            globalLoading.setAttribute('showed', 'false');
            console.error(`添加课程 「${classIdStr}」 过程出错:`, error);
            showToast(`添加课程 「${courseRawData.name || classIdStr}」 时发生错误，请查看控制台`, 'error');
        });
}

function removeCourse(classId) {
    const classIdStr = String(classId);
    const courseToRemove = globalCourses.find(course => String(course.id) === classIdStr);
    const originalLength = globalCourses.length;
    globalCourses = globalCourses.filter(course => String(course.id) !== classIdStr);

    if (globalCourses.length < originalLength) {
        saveData('userSelectedCourses', globalCourses);
        showToast(`课程 「${courseToRemove ? courseToRemove.name : ''} (${classIdStr})」 已从列表中移除`, 'success');
        initializeSelectedCourseTable();
    } else {
        showToast(`课程 「${classIdStr}」 未在列表中找到，无法移除`, 'error');
    }
}

function initializeSelectedCourseTable() {
    const table_body = document.getElementById('selected-table-body');
    const empty_message = document.getElementById('operation-panel-course-empty');
    table_body.innerHTML = ''; // 清空现有内容

    if (!globalCourses || globalCourses.length === 0) {
        empty_message.classList.remove('hidden');
        document.getElementById('selected-courses-count').innerText = '0';
        return;
    }
    empty_message.classList.add('hidden');

    globalCourses.forEach((course, index) => { // 添加 index 参数
        const table_line = document.createElement('s-tr');
        const name_td = document.createElement('s-td');
        const teacher_td = document.createElement('s-td');
        const class_time_td = document.createElement('s-td');
        const operation_td = document.createElement('s-td');

        // 新增按钮
        const pin_top_btn = document.createElement('s-button');

        const move_up_btn = document.createElement('s-button');
        move_up_btn.setAttribute("type", "elevated");

        const detail_btn = document.createElement('s-button');
        detail_btn.setAttribute("type", "filled-tonal");

        const remove_btn = document.createElement('s-button');
        remove_btn.setAttribute("type", "outlined");

        name_td.innerText = `${processCourseName(course.name, soft = false) || '未知课程'} (${course.id})`;
        name_td.style.alignContent = "center";

        teacher_td.innerText = course.teacher || '未知教师';
        teacher_td.style.alignContent = "center"

        const weeksDisplay = formatWeeksArrayToDisplayString(course.weeks);
        let dayDisplay = course.day ? `每周${WEEK_CN[String(course.day)] || '?'}` : "每周？";
        let sessionDisplay = "节次未知";
        if (course.sessions && typeof course.sessions.start !== 'undefined' && typeof course.sessions.end !== 'undefined') {
            sessionDisplay = `第 ${course.sessions.start} - ${course.sessions.end} 节`;
        }
        class_time_td.innerText = `第 ${weeksDisplay} 周，${dayDisplay}，${sessionDisplay}`;
        class_time_td.style.alignContent = "center"

        // 置顶按钮
        pin_top_btn.innerText = '置顶';
        pin_top_btn.setAttribute('classId', String(course.id));
        pin_top_btn.setAttribute('onclick', `pinCourseToTopInList('${String(course.id)}')`);
        pin_top_btn.style.marginRight = '8px';
        if (index === 0) {
            pin_top_btn.setAttribute('disabled', 'true');
        }

        // 上移按钮
        move_up_btn.innerText = '上移';
        move_up_btn.setAttribute('classId', String(course.id));
        move_up_btn.setAttribute('onclick', `moveCourseUpInList('${String(course.id)}')`);
        if (index === 0) {
            move_up_btn.setAttribute('disabled', 'true');
        }

        // 详情按钮
        detail_btn.innerText = '详情';
        detail_btn.setAttribute('classId', String(course.id));
        detail_btn.setAttribute('onclick', `showCourseDetail('${String(course.id)}')`);
        detail_btn.style.marginRight = '8px';

        // 移除按钮
        remove_btn.innerText = '移除';
        remove_btn.setAttribute('classId', String(course.id));
        remove_btn.setAttribute('onclick', `removeCourse('${String(course.id)}')`);
        remove_btn.setAttribute('type', 'outlined');

        const first_line_container = document.createElement("div");
        first_line_container.style.marginBottom = "8px";
        first_line_container.appendChild(pin_top_btn);
        first_line_container.appendChild(move_up_btn);
        const second_line_container = document.createElement("div");
        second_line_container.appendChild(detail_btn);
        second_line_container.appendChild(remove_btn);
        operation_td.appendChild(first_line_container);
        operation_td.appendChild(second_line_container);

        table_line.appendChild(name_td);
        table_line.appendChild(teacher_td);
        table_line.appendChild(class_time_td);
        table_line.appendChild(operation_td);

        table_body.appendChild(table_line);
    });
    document.getElementById('selected-courses-count').innerText = globalCourses.length.toString();
}


async function addTask() {
    if (globalCourses.length === 0) {
        showToast('课程列表为空，请先添加课程', 'error');
        return;
    }
    if (!globalLoggedIn || !globalCurrentUsername) {
        showToast('请先选择账号后再进行操作', 'error');
        return;
    }

    const startTimeValue = document.getElementById('task-start-time').value.trim();
    if (startTimeValue === '' || verifyTimeFormat(startTimeValue) === false) {
        showToast('任务开始时间格式不正确，请按照 YYYY-MM-DD HH:mm:SS 的格式填写，例如 2026-09-01 12:00:00', 'error');
        return;
    }

    const startTime = new Date(startTimeValue.replace(' ', 'T'));
    if (Number.isNaN(startTime.getTime())) {
        showToast('任务开始时间无效，请检查日期和时间', 'error');
        return;
    }

    const delayInput = document.getElementById('task-delay');
    const delay = Number(delayInput.value || 0.5);
    if (Number.isNaN(delay) || delay < 0.5) {
        showToast('抢课延迟不能小于 0.5 秒！', 'error');
        return;
    }

    const priorityModeSwitch = document.getElementById('task-priority-mode-switch');
    const addTaskBtn = document.getElementById('add-task-btn');
    const addTaskBtnLoading = document.getElementById('add-task-btn-loading');
    const coursesForPayload = globalCourses.map(course => {
        return {
            id: Number(course.id),
            name: String(course.name || ""),
            teacher: String(course.teacher || ""),
            category: String(course.category || ""),
            chosen: Number(course.chosen) || 0,
            limit: Number(course.limit) || 0,
            source: Number(course.source) || 0,
            note: String(course.note || "")
        };
    });

    const taskData = {
        username: globalCurrentUsername,
        config: {
            delay: `PT${delay}S`,
            retry: document.getElementById('task-auto-retry-switch').checked,
            priority_mode: priorityModeSwitch ? priorityModeSwitch.checked : false,
            start_at: startTime.toISOString(),
        },
        courses: coursesForPayload,
    };

    addTaskBtn.setAttribute('disabled', 'true');
    addTaskBtnLoading.classList.remove('hidden');
    globalLoading.setAttribute('showed', 'true');

    try {
        const response = await fetch("/api/grabber/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData)
        });
        const responseData = await response.json().catch(() => null);

        if (!response.ok || (responseData && responseData.error)) {
            const errorMessage = responseData?.message || response.statusText || `服务器返回状态码 ${response.status}`;
            showToast(`抢课任务添加失败: ${errorMessage}`, 'error');
            return;
        }

        showToast('抢课任务添加成功，请注意查看任务列表', 'success');
        await flushTaskTable();
    } catch (error) {
        console.error('添加抢课任务失败:', error);
        showDialog('错误', `添加抢课任务失败，请稍后重试或查看控制台\n${error.message || error}\n如果出现了严重的错误，可以考虑开个 issue: https://github.com/GDUTMeow/gdut-course-grabber/issues/new`, 'error');
    } finally {
        addTaskBtn.removeAttribute('disabled');
        addTaskBtnLoading.classList.add('hidden');
        globalLoading.setAttribute('showed', 'false');
    }
}

async function getTasks() {
    try {
        const response = await fetch("/api/grabber/", { method: 'GET' });
        if (response.ok) {
            return await response.json();
        } else {
            console.warn('获取任务列表失败，服务器返回状态码:', response.status);
            const err = await response.json().catch(() => ({ message: response.statusText }));
            showDialog('错误', `获取任务列表失败: ${err.message || response.statusText}`, 'error');
            return null;
        }
    } catch (error) {
        console.error('获取任务列表失败:', error);
        showDialog('错误', `获取任务列表失败: ${error.message}`, 'error');
        return null;
    }
}

async function getTaskStatus(taskId) {
    try {
        const response = await fetch(`/api/grabber/${taskId}/status`, { method: 'GET' });
        if (response.ok) {
            const data = await response.json();
            return data.data;
        } else {
            console.warn(`获取任务 ${taskId} 状态失败，服务器返回状态码:`, response.status);
            return null;
        }
    } catch (error) {
        console.error(`获取任务 ${taskId} 状态失败:`, error);
        return null;
    }
}

async function flushTaskTable() {
    const flushTaskTableBtn = document.getElementById('flush-task-table-btn');
    const flushTaskTableIndicator = document.getElementById('flush-task-table-indicator');
    flushTaskTableBtn.setAttribute('disabled', 'true');
    flushTaskTableIndicator.classList.remove('hidden');

    const tasksData = await getTasks();
    const table_body = document.getElementById('task-table-body');
    const empty_message = document.getElementById('task-empty-tip');

    if (empty_message) empty_message.classList.add('hidden');
    table_body.innerHTML = '';

    if (!tasksData || !tasksData.data || tasksData.data.length === 0) {
        if (empty_message) empty_message.classList.remove('hidden');
        showToast('没有找到抢课任务哦', 'info');
        flushTaskTableBtn.removeAttribute('disabled');
        flushTaskTableIndicator.classList.add('hidden');
        return;
    }
    if (empty_message) empty_message.classList.add('hidden');

    globalLoading.setAttribute('showed', 'true');

    for (const task of tasksData.data) {
        const taskId = task.key;
        const username = task.value.username || '未知账号';
        const coursesInTask = task.value.courses;
        const start_time = task.value.config.start_at ? new Date(task.value.config.start_at).toLocaleString() : '立即开始';
        const delay = task.value.config.delay;
        const retry = task.value.config.retry ? '开启' : '关闭';

        const priorityMode = task.value.config.priority_mode ? '开启' : '关闭';

        let statusValue = await getTaskStatus(taskId);
        let statusText = TASK_STATUS_MAP[statusValue] || "未知";

        const course_tags_td = document.createElement('s-td');
        course_tags_td.style.alignContent = 'center';
        if (Array.isArray(coursesInTask)) {
            coursesInTask.forEach(courseObj => {
                const course_tag = document.createElement('s-chip');
                let displayInfo = '未知课程';
                let actualId = null;

                if (typeof courseObj === 'object' && courseObj !== null && typeof courseObj.id !== 'undefined') {
                    actualId = String(courseObj.id);
                    displayInfo = `${processCourseName(courseObj.name, soft = false) || '未知名称'} (${actualId})`;
                }

                course_tag.innerText = displayInfo;
                course_tag.setAttribute('type', 'outlined');
                if (actualId) {
                    course_tag.setAttribute('clickable', 'true');
                    course_tag.setAttribute('classId', actualId);
                    course_tag.setAttribute('account-name', username);
                    course_tag.setAttribute('onclick', "showCourseDetail(this.getAttribute('classId'), this.getAttribute('account-name')); setTimeout(() => this.removeAttribute('checked'), 0);");
                }
                course_tags_td.appendChild(course_tag);
                course_tags_td.appendChild(document.createElement('br'));
            });
        }

        const operation_td = document.createElement('s-td');
        operation_td.style.alignContent = 'center';
        const toggle_btn = document.createElement('s-button');

        if (statusValue === 1 || statusValue === 2) {
            toggle_btn.innerText = '停止';
            toggle_btn.setAttribute('onclick', `stopTask('${taskId}')`);
        } else if (statusValue === 0) {
            toggle_btn.innerText = '启动';
            toggle_btn.setAttribute('onclick', `startTask('${taskId}')`);
        } else {
            toggle_btn.innerText = '状态未知';
            toggle_btn.setAttribute('disabled', 'true');
        }
        toggle_btn.style.marginRight = '8px';

        const remove_task_btn = document.createElement('s-button');
        remove_task_btn.innerText = '移除';
        remove_task_btn.setAttribute('taskId', String(taskId));
        remove_task_btn.setAttribute('onclick', "removeTask(this.getAttribute('taskId'))");
        remove_task_btn.setAttribute('type', 'outlined');

        operation_td.appendChild(toggle_btn);
        operation_td.appendChild(remove_task_btn);

        const table_line = document.createElement('s-tr');

        const task_id_td = document.createElement('s-td');
        task_id_td.style.alignContent = 'center';
        table_line.appendChild(task_id_td).innerText = taskId;

        const username_td = document.createElement('s-td');
        username_td.style.alignContent = 'center';
        table_line.appendChild(username_td).innerText = username;
        table_line.appendChild(course_tags_td);

        const start_time_td = document.createElement('s-td');
        start_time_td.style.alignContent = 'center';
        table_line.appendChild(start_time_td).innerText = start_time;

        const delay_td = document.createElement('s-td');
        delay_td.style.alignContent = 'center';
        delay_td.innerText = delay.replace('PT', '').replace('S', ' 秒');
        table_line.appendChild(delay_td);

        const priority_td = document.createElement('s-td');
        priority_td.style.alignContent = 'center';
        table_line.appendChild(priority_td).innerText = priorityMode;

        const retry_td = document.createElement('s-td');
        retry_td.style.alignContent = 'center';
        table_line.appendChild(retry_td).innerText = retry;

        const status_text_td = document.createElement('s-td');
        status_text_td.style.alignContent = 'center';
        table_line.appendChild(status_text_td).innerText = statusText;

        table_line.appendChild(operation_td);

        table_body.appendChild(table_line);
    }
    globalLoading.setAttribute('showed', 'false');
    flushTaskTableBtn.removeAttribute('disabled');
    flushTaskTableIndicator.classList.add('hidden');
}


async function startTask(taskId) {
    globalLoading.setAttribute('showed', 'true');
    fetch(`/api/grabber/${taskId}/start`, { method: 'GET' }).then(async response => {
        const responseData = await response.json().catch(() => null);
        if (response.ok && responseData?.data === true) {
            showToast(`任务 ${taskId} 已成功启动`, 'success');
        } else if (response.ok) {
            showToast(`任务 ${taskId} 已经处于启动状态`, 'info');
        } else {
            showToast(`启动任务 ${taskId} 失败: ${responseData?.message || response.statusText}`, 'error');
        }
    }).catch(error => {
        showToast(`启动任务 ${taskId} 失败: ${error.message}`, 'error');
    }).finally(() => {
        flushTaskTable();
        globalLoading.setAttribute('showed', 'false');
    });
}

async function stopTask(taskId) {
    globalLoading.setAttribute('showed', 'true');
    fetch(`/api/grabber/${taskId}/cancel`, { method: 'GET' }).then(async response => {
        const responseData = await response.json().catch(() => null);
        if (response.ok && responseData?.data === true) {
            showToast(`任务 ${taskId} 已成功停止`, 'success');
        } else if (response.ok) {
            showToast(`任务 ${taskId} 当前没有在运行`, 'info');
        } else {
            showToast(`停止任务 ${taskId} 失败: ${responseData?.message || response.statusText}`, 'error');
        }
    }).catch(error => {
        showToast(`停止任务 ${taskId} 失败: ${error.message}`, 'error');
    }).finally(() => {
        flushTaskTable();
        globalLoading.setAttribute('showed', 'false');
    });
}

function syncSessionId() {
    const cookieField = document.getElementById('cookie');
    const sessionId = cookieField.value.trim();
    const taskSessionIdField = document.getElementById('task-account');
    if (taskSessionIdField) {
        taskSessionIdField.value = sessionId;
    }
}

function verifyTimeFormat(timeString) {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    const field = document.getElementById('task-start-time');
    if (!regex.test(timeString.trim())) {
        field.setAttribute('error', 'true');
        return false;
    } else {
        field.removeAttribute('error');
    }
    return true;
}

async function removeTask(taskId) {
    globalLoading.setAttribute('showed', 'true');
    try {
        const response = await fetch(`/api/grabber/${taskId}`, { method: 'DELETE' });
        if (response.ok) {
            showToast(`任务 ${taskId} 已成功移除`, 'success');
        } else {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            console.warn(`移除任务 ${taskId} 失败:`, err.message || response.status);
            showToast(`移除任务 ${taskId} 失败: ${err.message || response.statusText}`, 'error');
        }
    } catch (error) {
        console.error(`移除任务 ${taskId} 失败:`, error);
        showToast(`移除任务 ${taskId} 失败: ${error.message}`, 'error');
    } finally {
        await flushTaskTable();
        globalLoading.setAttribute('showed', 'false');
    }
}

function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

function toggleAutoRefreshTaskTable() {
    const delayInput = document.getElementById('task-table-auto-refresh-delay');
    const delay = Number(delayInput.value);
    const refreshIndicator = document.getElementById('task-table-auto-refresh-indicator');
    const loadingIndicator = document.getElementById('task-table-auto-refresh-animation');

    if (globalAutoRefreshTask) {
        clearInterval(globalAutoRefreshTask);
        globalAutoRefreshTask = null;

        if (globalIndicatorInterval) {
            clearInterval(globalIndicatorInterval);
            globalIndicatorInterval = null;
        }

        refreshIndicator.classList.add('hidden');
        loadingIndicator.classList.add('hidden');
        refreshIndicator.value = 0;
        currentIndicatorSteps = 0;
    } else {
        if (isNaN(delay)) {
            showToast("刷新时间必须是一个数字！", 'error');
            delayInput.focus();
            return;
        }
        if (delay < 1) {
            showToast("刷新时间必须大于等于 1 秒！", 'error');
            delayInput.focus();
            return;
        }

        refreshIndicator.classList.remove('hidden');
        loadingIndicator.classList.remove('hidden');
        refreshIndicator.max = 100;
        refreshIndicator.value = 0;


        currentIndicatorSteps = 0;
        totalIndicatorStepsForCycle = delay * 10;

        globalIndicatorInterval = setInterval(() => {
            currentIndicatorSteps++;
            let percentage = (currentIndicatorSteps / totalIndicatorStepsForCycle) * 100;
            if (percentage > 100) {
                percentage = 100;
            }

            refreshIndicator.value = percentage;
        }, 100);

        globalAutoRefreshTask = setInterval(() => {
            flushTaskTable();

            currentIndicatorSteps = 0;
            refreshIndicator.value = 0;
        }, delay * 1000);
    }
}

function moveCourseUpInList(courseId) {
    const idToMove = String(courseId);
    if (!Array.isArray(window.globalCourses)) {
        console.error("globalCourses is not defined or not an array.");
        return;
    }
    const index = window.globalCourses.findIndex(course => String(course.id) === idToMove);

    if (index > 0) {
        [window.globalCourses[index - 1], window.globalCourses[index]] = [window.globalCourses[index], window.globalCourses[index - 1]];

        try {
            saveData('userSelectedCourses', window.globalCourses);
        } catch (e) {
            console.error("Error saving selected courses to localStorage:", e);
        }

        if (typeof window.initializeSelectedCourseTable === 'function') {
            window.initializeSelectedCourseTable();
        } else {
            console.error("initializeSelectedCourseTable function is not defined.");
        }
    }
}

function pinCourseToTopInList(courseId) {
    const idToPin = String(courseId);
    if (!Array.isArray(window.globalCourses)) {
        console.error("globalCourses is not defined or not an array.");
        return;
    }
    const index = window.globalCourses.findIndex(course => String(course.id) === idToPin);

    if (index > 0) {
        const [courseToPin] = window.globalCourses.splice(index, 1);
        window.globalCourses.unshift(courseToPin);

        try {
            saveData('userSelectedCourses', window.globalCourses);
        } catch (e) {
            console.error("Error saving selected courses to localStorage:", e);
        }

        if (typeof window.initializeSelectedCourseTable === 'function') {
            window.initializeSelectedCourseTable();
        } else {
            console.error("initializeSelectedCourseTable function is not defined.");
        }
    }
}

function processCourseName(name, soft = true) {
    let formattedCourseName = "";
    if (name && typeof name === 'string') {
        let tempName = name;
        while (tempName.length > MAX_COURSE_NAME_CHARS_PER_LINE) {
            let breakPoint = tempName.lastIndexOf(' ', MAX_COURSE_NAME_CHARS_PER_LINE);
            if (breakPoint === -1 || breakPoint < MAX_COURSE_NAME_CHARS_PER_LINE / 2) {
                breakPoint = MAX_COURSE_NAME_CHARS_PER_LINE;
            }
            formattedCourseName += tempName.substring(0, breakPoint).trim() + (soft ? "<br>" : "\n");
            tempName = tempName.substring(breakPoint).trim();
        }
        formattedCourseName += tempName;
    } else {
        formattedCourseName = name || "";
    }
    return decodeHtmlEntities(formattedCourseName);
}

function showToast(message, type = 'info') {
    Toastify(
        {
            text: message,
            duration: 3000,
            close: true,
            gravity: 'bottom',
            position: 'right',
            style: {
                background: type === 'error' ? 'linear-gradient(to right, #fb7185, #ef4444)' : (type === 'success' ? 'linear-gradient(to right, #34d399, #22d3ee)' : 'linear-gradient(to right, #6366f1, #3b82f6)'),
                borderRadius: '16px',
            },
            stopOnFocus: true,
        }
    ).showToast();
}

function saveData(key, value) {
    fetch(`/api/storage/${key}`, {
        method: 'PUT',
        body: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }).then(response => {
        if (response.ok) {
            return true;
        } else {
            showToast(`保存数据失败: ${response.statusText}`, 'error');
            return false;
        }
    }).catch(error => {
        console.error(`保存数据失败: ${error.message}`);
        showToast(`保存数据失败: ${error.message}`, 'error');
        return false;
    })
}

function getData(key) {
    return fetch(`/api/storage/${key}`)
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`获取数据 ${key} 失败: ${response.status} ${response.statusText}${text ? ` - ${text.substring(0, 100)}...` : ''}`);
                });
            }
            return response.json();
        })
        .then(jsonData => {
            if (jsonData && jsonData.hasOwnProperty('data')) {
                return jsonData.data;
            } else {
                return null;
            }
        })
        .catch(error => {
            console.error(`获取数据 ${key} 失败:`, error);
            return null;
        });
}

async function searchCourses() {
    const searchInput = document.getElementById('search-course-input');
    const searchTerm = searchInput.value.trim().toLowerCase();
    const courseTableBody = document.getElementById('content-table-body');
    const indicator = document.getElementById('search-btn-indicator');
    const loadMoreBtn = document.getElementById('load-more-btn');
    courseTableBody.innerHTML = ''; // 清空现有内容
    indicator.classList.remove('hidden');
    if (searchTerm === "") {
        populateCourseTable(globalLoadedCourses);
        indicator.classList.add('hidden');
        loadMoreBtn.classList.remove('hidden');
        return;
    }

    // const filteredCourses = globalLoadedCourses.filter(course => {
    //     const courseName = String(course.name || '').toLowerCase();
    //     const courseId = String(course.id || '');
    //     const courseTeacher = String(course.teacher || '').toLowerCase();
    //     const courseCategory = String(course.category || '').toLowerCase();

    //     return courseName.includes(searchTerm) ||
    //         courseId.includes(searchTerm) ||
    //         courseTeacher.includes(searchTerm) ||
    //         courseCategory.includes(searchTerm);
    // });

    if (!globalLoggedIn || !globalCurrentUsername) {
        showToast('请先选择账号后再进行操作', 'error');
        indicator.classList.add('hidden');
        return;
    }

    fetch(
        `/api/eas/courses?count=${1000}&page=1&keyword=${encodeURIComponent(searchTerm)}&username=${encodeURIComponent(globalCurrentUsername)}`,
    ).then(response => {
        if (response.ok) {
            // 填充课程数据到表格
            loadMoreBtn.classList.add('hidden');
            response.json().then(body => {
                const filteredCourses = body.data || [];
                if (filteredCourses.length > 0) {
                    populateCourseTable(filteredCourses);
                    indicator.classList.add('hidden');
                } else {
                    showToast('未找到匹配的课程', 'info');
                    indicator.classList.add('hidden');
                }
            })
        }
    }).catch(error => {
        console.error('搜索课程失败: ', error);
        showToast(`搜索课程失败，请稍候重试！`, 'error');
        indicator.classList.add('hidden');
    });
}


function populateCourseTable(coursesToDisplay) {
    coursesToDisplay.forEach(course => {
        addLineToCourseTable(
            decodeHtmlEntities(course.name),
            course.id,
            course.teacher,
            course.category,
            course.chosen,
            course.limit,
            course.source,
            course.note
        );
    });
}

function onDelayChange(element) {
    const value = element.value;
    if (isNaN(value) || value < 0.5) {
        element.value = 0.5;
        showToast('抢课延迟不能小于 0.5 秒，已自动调整为 0.5 秒');
    }
}

function onAccountChipClicked(element) {
    const container = document.getElementById("account-added-container")
    const chips = container.querySelectorAll("s-chip")
    if (!element.checked) {
        chips.forEach((chip) => {
            if (chip != element) {
                chip.setAttribute("checked", false) // 清理其他选项的选中状态
            }
        })
        globalCurrentUsername = element.getAttribute("account-name")
        globalLoggedIn = true
        document.getElementById("task-account").value = globalCurrentUsername
        document.getElementById('content-no-content-tip').classList.add('hidden')
        if (!globalCourseListLoaded) {
            flushCoursesTable()
        }
    } else {
        globalCurrentUsername = ""
        globalLoggedIn = false
        document.getElementById("task-account").value = "未选择，请先到课程列表页面选择账号"
    }
}

async function getAccountList() {
    var accountList = [];
    fetch("/api/account").then(resp => {
        if (resp.ok) {
            resp.json().then(data => {
                if (data && data.data && data.data.length > 0) {
                    populateAccountChips(data.data)
                } else {
                    document.getElementById("account-added-container-tips").style.display = ''
                }
            })
        }
    })
}

async function deleteAccount(username) {
    fetch(`/api/account/?username=${username}`, {
        method: 'DELETE',
    }).then(resp => {
        if (resp.ok) {
            showToast(`账号 ${username} 已删除`, 'success')
            getAccountList()
        } else {
            resp.json().then(data => {
                showToast(`账号删除失败: ${data.message || resp.statusText}`, "error")
            }).catch(() => {
                showToast(`账号删除失败: ${resp.statusText}`, "error")
            })
        }
    })
}

function populateAccountChips(accounts) {
    const container = document.getElementById("account-added-container")
    // 清理所有 s-chip
    container.querySelectorAll("s-chip").forEach((chip) => {
        chip.remove()
    })
    document.getElementById("account-added-container-tips").style.display = 'none'
    accounts.forEach((account) => {
        chip = `<s-chip account-name="${account.username}" clickable="true" onclick="onAccountChipClicked(this)">
                    <s-icon slot="start">
                    <svg t="1784795594199" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3946" width="200" height="200"><path d="M515.131392 563.202048c155.492352 0 281.544704-126.075904 281.544704-281.544704 0-155.492352-126.053376-281.544704-281.544704-281.544704-155.497472 0-281.547776 126.052352-281.547776 281.544704C233.58464 437.126144 359.634944 563.202048 515.131392 563.202048zM643.106816 359.1424c0 0-6.398976 101.680128-131.175424 101.680128-124.777472 0-124.777472-101.680128-124.777472-101.680128L643.106816 359.1424zM515.131392 614.391808c-332.112896 0-409.522176 170.066944-409.522176 409.496576l819.04128 0C924.650496 783.058944 848.638976 614.391808 515.131392 614.391808z" fill="#231815" p-id="3947"></path></svg>
                    </s-icon>
                    <s-icon-button slot="action" onclick="deleteAccount('${account.username}')">
                        <s-icon name="close"></s-icon>
                    </s-icon-button>
                    ${account.username}
                </s-chip>`
        container.insertAdjacentHTML('beforeend', chip)
    })
}

function addAccount() {
    const accountInput = document.getElementById("username-input")
    const accountName = accountInput.value.trim()
    const passwordInput = document.getElementById("password-input")
    const password = passwordInput.value.trim()
    const addAccountBtn = document.getElementById("add-account-btn")
    const addAccountBtnLoading = document.getElementById("add-account-btn-loading")
    addAccountBtn.setAttribute("disabled", "true")
    addAccountBtnLoading.classList.remove("hidden")
    if (accountName === "") {
        showToast("账号名称不能为空", "error")
        addAccountBtn.removeAttribute("disabled")
        addAccountBtnLoading.classList.add("hidden")
        return
    }
    fetch("/api/account", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username: accountName, password: password })
    }).then(resp => {
        if (resp.ok) {
            showToast("账号添加成功", "success")
            accountInput.value = ""
            passwordInput.value = ""
            getAccountList()
        } else {
            resp.json().then(data => {
                showToast(`账号添加失败: ${data.message || resp.statusText}`, "error")
            }).catch(() => {
                showToast(`账号添加失败: ${resp.statusText}`, "error")
            })
        }
    }).catch(error => {
        console.error("添加账号失败:", error)
        showToast(`添加账号失败: ${error.message || error}`, "error")
    })
        .finally(() => {
            addAccountBtn.removeAttribute("disabled")
            addAccountBtnLoading.classList.add("hidden")
        })
}


document.addEventListener('DOMContentLoaded', () => {
    initialize();
    changeAccentColor();
    const cookieInput = document.getElementById('cookie');
    if (cookieInput) {
        cookieInput.addEventListener('input', syncSessionId);
    }
});