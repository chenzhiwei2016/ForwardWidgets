import argparse
import requests
import time

# 豆瓣用户ID
DOUBAN_USER_ID = "292574889"
# TRAKT API APPS的Client ID，请前往 https://trakt.tv/oauth/applications/new 创建
TRAKT_CLIENT_ID = ""
# TRAKT抓包获取的x-csrf-token，需有增删改操作的接口才有
TRAKT_X_CSRF_TOKEN = ""
# TRAKT抓包获取的cookie
TRAKT_COOKIE = ""


# 获取豆瓣列表
def get_douban(watch_type="done", start=0, count=100):
    url = f"https://m.douban.com/rexxar/api/v2/user/{DOUBAN_USER_ID}/interests?status={watch_type}&start={start}&count={count}"
    response = requests.get(url, headers={"Referer": "https://m.douban.com/mine/movie", "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"},
                            verify=False)
    response.raise_for_status()
    return response.json().get('interests', [])


# Trakt搜索函数
def search_trakt(title, douban_year, douban_type):
    trakt_type = "movie" if douban_type == "movie" else "show"
    url = f"https://api.trakt.tv/search/{trakt_type}?query={title}"
    response = requests.get(url, headers={"trakt-api-version": "2", "trakt-api-key": TRAKT_CLIENT_ID, "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"},
                            verify=False)
    if response.status_code == 200 and response.json():
        if douban_year.isdigit():
            year = int(douban_year)
            for item in response.json():
                trakt_year = item[trakt_type]["year"]
                if not trakt_year:
                    continue
                if (trakt_year - 1) <= year <= (trakt_year + 1):
                    return item[trakt_type]["ids"]["slug"]
        else:
            return response.json()[0][trakt_type]["ids"]["slug"]
    return None


# Trakt标记函数
def mark_trakt(mark_type, slug, douban_type, watched_time):
    trakt_type = "movies" if douban_type == "movie" else "shows"
    watch_type = "movie" if douban_type == "movie" else "show"
    url = f"https://trakt.tv/{trakt_type}/{slug}/{mark_type}"
    response = requests.post(url,
                             headers={"x-csrf-token": TRAKT_X_CSRF_TOKEN, "cookie": TRAKT_COOKIE, "User-Agent":
                                 "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"},
                             json={"type": watch_type, "watched_at": watched_time, "collected_at": watched_time},
                             verify=False)
    if response.status_code == 200 or response.status_code == 201:
        print(f"✅ Marked {slug} as {mark_type}.")
    else:
        print(f"❌ Failed to mark {slug} as {mark_type}: {response.status_code}")


# Trakt打分函数
def rate_trakt(stars, slug, douban_type):
    trakt_stars = int(stars) * 2
    trakt_type = "movies" if douban_type == "movie" else "shows"
    watch_type = "movie" if douban_type == "movie" else "show"
    url = f"https://trakt.tv/{trakt_type}/{slug}/rate"
    response = requests.post(url,
                             headers={"x-csrf-token": TRAKT_X_CSRF_TOKEN, "cookie": TRAKT_COOKIE,
                                      "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent":
                                          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", },
                             data=f"type={watch_type}&stars={trakt_stars}",
                             verify=False)
    if response.status_code == 200 or response.status_code == 201:
        print(f"✅ Stared {slug} {trakt_stars}.")
    else:
        print(f"❌ Failed to stared {slug}: {response.status_code}")


def migrate_douban_to_trakt():
    parser = argparse.ArgumentParser(description="豆瓣想看/已看迁移Trakt脚本，运行前先填写脚本内必要参数")
    parser.add_argument(
        "-t",
        "--type",
        choices=["watched", "watchlist"],  # 限定只能选这两个值
        required=True,  # 必填参数
        help="迁移类型：watched 或 watchlist"
    )
    args = parser.parse_args()

    mark_type = "watch" if args.type == "watched" else "watchlist"
    watch_type = "done" if args.type == "watched" else "mark"
    print(f"迁移类型: {mark_type}")

    start = 0
    count = 50
    while True:
        douban_list = get_douban(watch_type=watch_type, start=start, count=count)
        if not douban_list:
            break
        for index, item in enumerate(douban_list):
            print(f"index: {start + index}")
            title = item['subject']['title']
            douban_type = item['subject']['type']
            if douban_type == "book" or douban_type == "music":
                continue
            douban_year = item['subject']['year']
            watched_time = item['create_time']
            print(f"🔍 Searching Trakt for: {title} {douban_year} {douban_type}")
            slug = search_trakt(title, douban_year, douban_type)
            if slug:
                mark_trakt(mark_type, slug, douban_type, watched_time)
                time.sleep(4)  # Prevent rate-limiting
                if item['rating']:
                    rate_trakt(item['rating']['value'], slug, douban_type)
                    time.sleep(4)  # Prevent rate-limiting
            else:
                print(f"❓ Could not find '{title} {douban_year} {douban_type}' on Trakt.")
        start += count


if __name__ == "__main__":
    migrate_douban_to_trakt()
