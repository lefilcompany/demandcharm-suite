"""Helpers de seleção: XPaths PT-BR e waits robustos."""
from __future__ import annotations

import re
import time
from typing import Iterable

from selenium.common.exceptions import (
    ElementClickInterceptedException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait


def _xpath_lower(text_expr: str) -> str:
    # tradução PT-BR case-insensitive
    return (
        f"translate({text_expr}, "
        "'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
        "'abcdefghijklmnopqrstuvwxyzáàâãäéèêëíìîïóòôõöúùûüç')"
    )


def find_button_by_text(driver: WebDriver, *needles: str, timeout: float = 15) -> WebElement:
    """Acha primeiro <button> cujo texto contém (case-insensitive) qualquer needle."""
    lowered = [n.lower() for n in needles]
    cond = " or ".join(
        f"contains({_xpath_lower('.')}, {repr(n)})" for n in lowered
    )
    xpath = f"//button[{cond}]"
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.XPATH, xpath))
    )


def find_text(driver: WebDriver, pattern: re.Pattern[str] | str, timeout: float = 10) -> WebElement:
    """Aguarda algum nó visível cujo textContent bata com o padrão."""
    if isinstance(pattern, str):
        pattern = re.compile(pattern, re.IGNORECASE)

    end = time.time() + timeout
    last_exc: Exception | None = None
    while time.time() < end:
        try:
            els = driver.find_elements(By.XPATH, "//*[normalize-space(text())!='']")
            for el in els:
                try:
                    if not el.is_displayed():
                        continue
                    if pattern.search(el.text or ""):
                        return el
                except StaleElementReferenceException:
                    continue
        except Exception as e:  # noqa: BLE001
            last_exc = e
        time.sleep(0.25)
    raise TimeoutException(f"texto não encontrado: {pattern.pattern} ({last_exc})")


def text_visible(driver: WebDriver, pattern: re.Pattern[str] | str, timeout: float = 8) -> bool:
    try:
        find_text(driver, pattern, timeout)
        return True
    except TimeoutException:
        return False


def force_click(driver: WebDriver, el: WebElement) -> None:
    try:
        el.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", el)


def wait_for_app(driver: WebDriver, timeout: float = 20) -> None:
    """Aguarda root do React montar conteúdo."""
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script(
            "const r=document.getElementById('root');return !!(r && r.childElementCount>0);"
        )
    )


def wait_for_dialog(driver: WebDriver, timeout: float = 15) -> WebElement:
    """Aguarda um Radix Dialog aberto (data-state='open' e role='dialog')."""
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located(
            (By.CSS_SELECTOR, "[role='dialog'][data-state='open']")
        )
    )


def count_text(driver: WebDriver, pattern: re.Pattern[str] | str) -> int:
    if isinstance(pattern, str):
        pattern = re.compile(pattern, re.IGNORECASE)
    els = driver.find_elements(By.XPATH, "//*")
    n = 0
    for el in els:
        try:
            if el.is_displayed() and pattern.search(el.text or ""):
                n += 1
        except StaleElementReferenceException:
            continue
    return n
