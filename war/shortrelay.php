<?php
//
// This module acts as a relay to any URL shortener with a suitable API.
// Update the API call below if using a service other than TinyURL.
//
header('Content-Type: text/plain; charset=utf-8');

if (!isset($_GET['v']) || $_GET['v'] === '') {
	http_response_code(400);
	echo 'Missing URL to shorten.';
	exit;
}

$serveraddr = 'http' . (isset($_SERVER['HTTPS']) ? 's' : '') . '://' . "{$_SERVER['HTTP_HOST']}";
$s = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('shortrelay.php', 'circuitjs.html', $s);
$target = $_GET['v'];
if (!preg_match('/^https?:\/\//', $target)) {
	$target = $serveraddr . $path . $target;
}

// TinyURL expects the target URL as a single encoded query parameter.
$apiUrl = 'https://tinyurl.com/api-create.php?url=' . rawurlencode($target);

if (function_exists('curl_init')) {
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $apiUrl);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
	curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
	curl_setopt($ch, CURLOPT_TIMEOUT, 20);
	curl_setopt($ch, CURLOPT_USERAGENT, 'CircuitJS short URL relay');
	$response = curl_exec($ch);
	if ($response === false) {
		http_response_code(502);
		echo 'TinyURL request failed: ' . curl_error($ch);
		curl_close($ch);
		exit;
	}
	$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	curl_close($ch);
	if ($status < 200 || $status >= 300) {
		http_response_code(502);
		echo 'TinyURL returned HTTP ' . $status . '.';
		exit;
	}
	echo $response;
	exit;
}

$response = @file_get_contents($apiUrl);
if ($response === false) {
	http_response_code(502);
	echo 'TinyURL request failed: no HTTP client is available on the server.';
	exit;
}

echo $response;
exit;
?>
