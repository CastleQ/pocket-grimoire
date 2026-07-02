<?php
// php 내장 서버용 라우터: 정적 파일(CSS/JS/이미지)은 그대로 내보내고,
// 그 외 경로만 Symfony(public/index.php)로 전달한다.
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    return false; // 실제 파일이 있으면 내장 서버가 직접 서빙
}
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/public/index.php';
